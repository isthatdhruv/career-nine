#!/usr/bin/env python3
"""
Phase 4: AI Summaries (CHECKPOINT)
Generates AI Summary and Learning Style Summary using OpenAI API
Input: suitability_index sheet
Output: AI_Summary and Learning_Style_Summary columns added
⚠️ Requires OPENAI_API_KEY in .env file
⚠️ This step costs money and should be reviewed before continuing
"""

import os
import sys
import json
import csv
import time
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
import pandas as pd
from datetime import datetime
import argparse

# ============================================================================
# ARGUMENTS
# ============================================================================
parser = argparse.ArgumentParser(description="Generate AI summaries with resume, batching and caching")
parser.add_argument('--input', default='input.xlsx', help='Input Excel file (default: input.xlsx)')
parser.add_argument('--sheet', default='suitability_index', help='Sheet name (default: suitability_index)')
parser.add_argument('--batch-size', type=int, default=None, help='Process only this many students')
parser.add_argument('--offset', type=int, default=0, help='Start from this index offset')
parser.add_argument('--resume', action='store_true', help='Skip students already cached or summarized in Excel')
parser.add_argument('--concurrency', type=int, default=1, help='Reserved for future parallelism (sequential by default)')
parser.add_argument('--export-prompts', action='store_true', help='Export prompts as JSON instead of calling API')
parser.add_argument('--save-results', type=str, help='Path to JSON file containing results to save')
args = parser.parse_args()

print("=" * 70, flush=True)
print("PHASE 4: AI SUMMARIES", flush=True)
if not args.export_prompts and not args.save_results:
    print("⚠️  WARNING: This uses OpenAI API and will incur costs", flush=True)
print("=" * 70, flush=True)
print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
print(flush=True)

# ============================================================================
# LOAD ENVIRONMENT
# ============================================================================
print("Loading environment...", flush=True)
start_time = datetime.now()

load_dotenv()
print(f"  ✅ .env file loaded ({datetime.now() - start_time})", flush=True)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY and not args.export_prompts and not args.save_results:
    print("❌ ERROR: Missing OPENAI_API_KEY in .env file", flush=True)
    print("   Please add: OPENAI_API_KEY=your_key_here", flush=True)
    exit(1)

if not args.export_prompts and not args.save_results:
    print(f"  ✅ API key found: {OPENAI_API_KEY[:10]}...", flush=True)
    print("  ⏱️  Initializing OpenAI client...", flush=True)
    client_init_start = datetime.now()
    client = OpenAI(api_key=OPENAI_API_KEY)
    client_init_time = datetime.now() - client_init_start
    print(f"  ✅ OpenAI client initialized ({client_init_time})", flush=True)
    print(f"  ℹ️  Client init took: {client_init_time.total_seconds():.2f} seconds", flush=True)

# ============================================================================
# LOAD DATA
# ============================================================================
print("\nLoading data...", flush=True)

INPUT_FILE = args.input
SHEET_NAME = args.sheet

df = pd.read_excel(INPUT_FILE, sheet_name=SHEET_NAME)

print(f"  ✅ Loaded {len(df)} students from {INPUT_FILE} [{SHEET_NAME}]", flush=True)

# Ensure output columns exist
if 'AI_Summary' not in df.columns:
    df['AI_Summary'] = ''
if 'Learning_Style_Summary' not in df.columns:
    df['Learning_Style_Summary'] = ''

# Prepare cache/progress
AI_CACHE_DIR = Path('ai_cache')
AI_CACHE_DIR.mkdir(exist_ok=True)
AI_PROGRESS_CSV = Path('ai_progress.csv')

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def clean_output(text):
    """Clean OpenAI output (original behavior)."""
    return text.replace("***", "").strip()

def is_blank(value) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and pd.isna(value):
        return True
    value_str = str(value).strip().lower()
    return value_str in ("", "nan", "none", "null")

def generate_openai_response(prompt, retries=3):
    """Generate response from OpenAI with retry logic"""
    for attempt in range(retries):
        try:
            print(f"    🔄 API call attempt {attempt + 1}/{retries}...", flush=True)
            api_start = datetime.now()
            
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                temperature=1,
                max_tokens=2048,
                top_p=1,
                frequency_penalty=0,
                presence_penalty=0
            )
            
            api_time = datetime.now() - api_start
            print(f"    ⏱️  API response received ({api_time.total_seconds():.2f}s)", flush=True)
            
            return clean_output(response.choices[0].message.content)
        except Exception as e:
            print(f"    ⚠️ Attempt {attempt + 1} failed: {e}", flush=True)
            if attempt < retries - 1:
                print(f"    ⏳ Waiting 2 seconds before retry...", flush=True)
                time.sleep(2)
            else:
                return f"Error generating summary: {str(e)}"

def get_student_id(row):
    school = str(row.get('School', '') or '').strip().lower()
    name = str(row.get('Name', '') or '').strip().lower()
    cls = str(row.get('Class', '') or '').strip().lower()
    return f"{name}__class_{cls}__school_{school}".replace(' ', '_')

def load_cache(student_id):
    cache_file = AI_CACHE_DIR / f"{student_id}.json"
    if cache_file.exists():
        try:
            with cache_file.open('r') as f:
                return json.load(f)
        except Exception:
            return None
    return None

def save_cache(student_id, ai_summary, learning_summary):
    cache_file = AI_CACHE_DIR / f"{student_id}.json"
    payload = {
        'student_id': student_id,
        'ai_summary': ai_summary,
        'learning_style_summary': learning_summary,
        'saved_at': datetime.now().isoformat()
    }
    with cache_file.open('w') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

def append_progress(name, status, note=""):
    header_needed = not AI_PROGRESS_CSV.exists()
    with AI_PROGRESS_CSV.open('a', newline='') as f:
        writer = csv.writer(f)
        if header_needed:
            writer.writerow(['timestamp', 'name', 'status', 'note'])
        writer.writerow([datetime.now().isoformat(timespec='seconds'), name, status, note])

# ============================================================================
# SAVE RESULTS MODE
# ============================================================================
if args.save_results:
    print(f"\nSaving results from {args.save_results}...", flush=True)
    try:
        with open(args.save_results, 'r') as f:
            results = json.load(f)
        
        updates_count = 0
        
        # Create a mapping of student_id to row index for faster lookup
        id_to_idx = {}
        for idx, row in df.iterrows():
            id_to_idx[get_student_id(row)] = idx
            
        for item in results:
            student_id = item.get('student_id')
            ai_summary = item.get('ai_summary')
            learning_summary = item.get('learning_style_summary')
            
            if not student_id:
                continue
                
            if student_id in id_to_idx:
                idx = id_to_idx[student_id]
                df.at[idx, 'AI_Summary'] = ai_summary
                df.at[idx, 'Learning_Style_Summary'] = learning_summary
                save_cache(student_id, ai_summary, learning_summary)
                updates_count += 1
        
        # Save to Excel
        with pd.ExcelWriter(INPUT_FILE, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
            df.to_excel(writer, sheet_name=SHEET_NAME, index=False)
            
        print(f"✅ Updated {updates_count} students from external results", flush=True)
        exit(0)
        
    except Exception as e:
        print(f"❌ Error saving results: {e}", flush=True)
        exit(1)

# ============================================================================
# EXPORT PROMPTS MODE
# ============================================================================
if args.export_prompts:
    print("\nExporting prompts...", flush=True)
    prompts_data = []
    
    total = len(df)
    start_index = max(0, args.offset)
    end_index = total if args.batch_size is None else min(total, start_index + args.batch_size)
    
    for idx in range(start_index, end_index):
        row = df.iloc[idx]
        name = row.get('Name', f'Row{idx}')
        class_num = row.get('Class', '')
        student_id = get_student_id(row)
        
        # Check cache/resume
        if args.resume:
            if not is_blank(row.get('AI_Summary', '')) and not is_blank(row.get('Learning_Style_Summary', '')):
                continue
            cached = load_cache(student_id)
            if cached and cached.get('ai_summary') and cached.get('learning_style_summary'):
                continue

        # Prepare data for prompts
        personality_1 = row.get('Personality_Top1', '')
        personality_2 = row.get('Personality_Top2', '')
        intelligence_1 = row.get('Intelligence_Top1', '')
        intelligence_2 = row.get('Intelligence_Top2', '')
        learning_style_1 = row.get('Learning_Style_1', '')
        learning_style_2 = row.get('Learning_Style_2', '')
        learning_style_3 = row.get('Learning_Style_3', '')
        career_pathway = row.get('suitability_index_1', '')
        weak_ability = row.get('Weak_Ability', '')
        
        ai_summary_prompt = (
            f"Generate a summary of a student's profile under 200 words, designed to help them gain confidence and a better understanding of themselves. "
            f"The summary must include the following details: "
            f"Name: {name}, "
            f"Standard: {class_num}, "
            f"Top 2 Personality Codes Interpretation: Explain the top two personality traits {personality_1} and {personality_2} and how they positively influence the student's strengths, behaviors, and approach to life, "
            f"Top 2 Intelligence Types Explanation: Provide a brief explanation of the student's top two intelligences {intelligence_1} and {intelligence_2}, focusing on their natural skills and how they can apply these abilities, "
            f"Learning Style Identified: Mention the student's preferred learning styles {learning_style_1}, {learning_style_2}, and {learning_style_3} and how they can use them to enhance their studies effectively, "
            f"Recommended Career Pathway: Suggest a suitable career pathway {career_pathway} based on their strengths and interests, "
            f"Weak Ability Identified and Recommendations: Highlight one weak ability {weak_ability if str(weak_ability).strip() else 'communication'} positively and include actionable recommendations for improvement. "
            f"Use motivational, simple, and encouraging language so the student feels empowered after reading the summary. Address the student in second person directly."
        )
        
        learning_style_prompt = (
            f"Generate a concise, motivational summary of a student's profile in no more than 160 words. "
            f"The summary must include:\\n\\n"
            f"1. Name: {name}\\n\\n"
            f"2. Top 3 Intelligence Types: Briefly describe the top three intelligences ({intelligence_1}, {intelligence_2}, and {learning_style_1}) that highlight the student's natural strengths.\\n\\n"
            f"3. Strengths in Finding Learning Style: Connect these intelligences to their preferred learning style ({learning_style_1}, {learning_style_2}, {learning_style_3}) and explain how the student can use this understanding to excel in their studies.\\n\\n"
            f"Use simple, positive, and encouraging language, ensuring the summary empowers the student to embrace their strengths and improve their learning approach. Address the student in second person directly."
        )
        
        prompts_data.append({
            'student_id': student_id,
            'name': name,
            'ai_summary_prompt': ai_summary_prompt,
            'learning_style_prompt': learning_style_prompt
        })
        
    print(f"JSON_RESULT:{json.dumps(prompts_data)}", flush=True)
    exit(0)

# ============================================================================
# GENERATE SUMMARIES (Original Mode)
# ============================================================================
print("\nGenerating AI summaries...", flush=True)
print("⏱️  This may take time depending on number of students...", flush=True)
print(flush=True)

total = len(df)
start_index = max(0, args.offset)
end_index = total if args.batch_size is None else min(total, start_index + args.batch_size)

print(f"  ▶️ Processing students {start_index + 1} to {end_index} of {total}", flush=True)

for idx in range(start_index, end_index):
    row = df.iloc[idx]
    name = row.get('Name', f'Row{idx}')
    class_num = row.get('Class', '')
    student_id = get_student_id(row)

    print(f"  Processing {idx + 1}/{total}: {name}", flush=True)

    # Resume logic
    if args.resume:
        if not is_blank(row.get('AI_Summary', '')) and not is_blank(row.get('Learning_Style_Summary', '')):
            print("    ⏭️  Skipping (already summarized in Excel)", flush=True)
            # Ensure cache exists even for skipped students
            if not load_cache(student_id):
                save_cache(student_id, str(row.get('AI_Summary', '')), str(row.get('Learning_Style_Summary', '')))
            append_progress(name, 'skipped_excel')
            continue
        cached = load_cache(student_id)
        if cached and cached.get('ai_summary') and cached.get('learning_style_summary'):
            print("    ♻️  Using cached summaries", flush=True)
            df.at[idx, 'AI_Summary'] = cached['ai_summary']
            df.at[idx, 'Learning_Style_Summary'] = cached['learning_style_summary']
            # Immediate save to Excel
            with pd.ExcelWriter(INPUT_FILE, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
                df.to_excel(writer, sheet_name=SHEET_NAME, index=False)
            append_progress(name, 'restored_cache')
            continue

    # Prepare data for prompts
    personality_1 = row.get('Personality_Top1', '')
    personality_2 = row.get('Personality_Top2', '')
    intelligence_1 = row.get('Intelligence_Top1', '')
    intelligence_2 = row.get('Intelligence_Top2', '')
    learning_style_1 = row.get('Learning_Style_1', '')
    learning_style_2 = row.get('Learning_Style_2', '')
    learning_style_3 = row.get('Learning_Style_3', '')
    career_pathway = row.get('suitability_index_1', '')
    weak_ability = row.get('Weak_Ability', '')
    
    # ========================================================================
    # AI SUMMARY PROMPT
    # ========================================================================
    ai_summary_prompt = (
        f"Generate a summary of a student's profile under 200 words, designed to help them gain confidence and a better understanding of themselves. "
        f"The summary must include the following details: "
        f"Name: {name}, "
        f"Standard: {class_num}, "
        f"Top 2 Personality Codes Interpretation: Explain the top two personality traits {personality_1} and {personality_2} and how they positively influence the student's strengths, behaviors, and approach to life, "
        f"Top 2 Intelligence Types Explanation: Provide a brief explanation of the student's top two intelligences {intelligence_1} and {intelligence_2}, focusing on their natural skills and how they can apply these abilities, "
        f"Learning Style Identified: Mention the student's preferred learning styles {learning_style_1}, {learning_style_2}, and {learning_style_3} and how they can use them to enhance their studies effectively, "
        f"Recommended Career Pathway: Suggest a suitable career pathway {career_pathway} based on their strengths and interests, "
        f"Weak Ability Identified and Recommendations: Highlight one weak ability {weak_ability if str(weak_ability).strip() else 'communication'} positively and include actionable recommendations for improvement. "
        f"Use motivational, simple, and encouraging language so the student feels empowered after reading the summary. Address the student in second person directly."
    )
    
    # Generate AI Summary
    print(f"    📝 Generating AI Summary...", flush=True)
    ai_summary = generate_openai_response(ai_summary_prompt)
    df.at[idx, 'AI_Summary'] = ai_summary
    print(f"    ✅ AI Summary generated", flush=True)
    
    # ========================================================================
    # LEARNING STYLE SUMMARY PROMPT
    # ========================================================================
    learning_style_prompt = (
        f"Generate a concise, motivational summary of a student's profile in no more than 160 words. "
        f"The summary must include:\\n\\n"
        f"1. Name: {name}\\n\\n"
        f"2. Top 3 Intelligence Types: Briefly describe the top three intelligences ({intelligence_1}, {intelligence_2}, and {learning_style_1}) that highlight the student's natural strengths.\\n\\n"
        f"3. Strengths in Finding Learning Style: Connect these intelligences to their preferred learning style ({learning_style_1}, {learning_style_2}, {learning_style_3}) and explain how the student can use this understanding to excel in their studies.\\n\\n"
        f"Use simple, positive, and encouraging language, ensuring the summary empowers the student to embrace their strengths and improve their learning approach. Address the student in second person directly."
    )
    
    # Generate Learning Style Summary
    print(f"    📚 Generating Learning Style Summary...", flush=True)
    learning_summary = generate_openai_response(learning_style_prompt)
    df.at[idx, 'Learning_Style_Summary'] = learning_summary
    print(f"    ✅ Learning Style Summary generated", flush=True)
    
    # Save to cache immediately
    save_cache(student_id, ai_summary, learning_summary)
    print(f"    💾 Saved to ai_cache/{student_id}.json", flush=True)
    append_progress(name, 'saved_cache')

    # Immediate save to Excel
    with pd.ExcelWriter(INPUT_FILE, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
        df.to_excel(writer, sheet_name=SHEET_NAME, index=False)
    append_progress(name, 'saved_excel')
    
    # Small delay to avoid rate limiting
    if idx < len(df) - 1:
        print(f"    ⏳ Rate limiting delay...", flush=True)
        time.sleep(1)

# ============================================================================
# SAVE RESULTS
# ============================================================================
print("\n" + "=" * 70, flush=True)
print("Saving results...", flush=True)

with pd.ExcelWriter(INPUT_FILE, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
    df.to_excel(writer, sheet_name=SHEET_NAME, index=False)

processed_count = (end_index - start_index)
print(f"✅ Phase 4 Complete!", flush=True)
print(f"   Added/updated AI_Summary and Learning_Style_Summary columns", flush=True)
print(f"   Students processed this run: {processed_count}", flush=True)
print(f"   Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
print(flush=True)
print("⚠️  CHECKPOINT: Please review the AI summaries before proceeding to next phase", flush=True)
print("=" * 70, flush=True)