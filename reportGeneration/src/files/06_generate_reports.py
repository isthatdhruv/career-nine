#!/usr/bin/env python3
"""
Phase 6: Report Generation
Class-aware report generation orchestrator
Input: Master_Sheet with all enriched data
Output: Individual HTML reports per student
Routes students to appropriate templates:
  - Class 6-8  → Templates/HTML Templates/6-8.html  → Insight Navigator
  - Class 9-10 → Templates/HTML Templates/9-10.html → Stream Navigator
  - Class 11-12 → Templates/HTML Templates/11-12.html → Career Navigator
"""

import re
import os
import shutil
import pandas as pd
from datetime import datetime

print("=" * 70)
print("PHASE 6: REPORT GENERATION")
print("=" * 70)
print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(SCRIPT_DIR, 'Templates', 'HTML Templates')
# Fallback: check parent directory if templates not in files/
if not os.path.isdir(TEMPLATE_DIR):
    TEMPLATE_DIR = os.path.join(SCRIPT_DIR, '..', 'Templates', 'HTML Templates')
INPUT_FILE = os.path.join(SCRIPT_DIR, 'input.xlsx')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'Reports', 'english')

templates = {
    '6-8': os.path.join(TEMPLATE_DIR, '6-8.html'),
    '9-10': os.path.join(TEMPLATE_DIR, '9-10.html'),
    '11-12': os.path.join(TEMPLATE_DIR, '11-12.html'),
}

report_names = {
    '6-8': 'Insight_Navigator',
    '9-10': 'Stream_Navigator',
    '11-12': 'Career_Navigator',
}

# Mapping: template placeholder → Master_Sheet column name
PLACEHOLDER_MAP = {
    # Basic info
    'name': 'Name',
    'name_caps': 'Name_Caps',
    'f_name': 'First Name',
    'class': 'Class',
    'school': 'School',

    # Personality
    'personality_1_text': 'Personality 1 Text',
    'personality_1_image': 'Personality 1 Image',
    'personality_2_text': 'Personality 2 Text',
    'personality_2_image': 'Personality 2 Image',
    'personality_3_text': 'Personality 3 Text',
    'personality_3_image': 'Personality 3 Image',

    # Intelligence
    'intelligence_1_text': 'Intelligence 1 Text',
    'intelligence_1_image': 'Intelligence 1 Image',
    'intelligence_2_text': 'Intelligence 2 Text',
    'intelligence_2_image': 'Intelligence 2 Image',
    'intelligence_3_text': 'Intelligence 3 Text',
    'intelligence_3_image': 'Intelligence 3 Image',

    # Learning styles
    'learning_style': 'Learning Style Summary',
    'learning_style_1': 'Learning Style 1',
    'learning_style_2': 'Learning Style 2',
    'learning_style_3': 'Learning Style 3',
    'enjoys_with_1': 'Enjoys With 1',
    'enjoys_with_2': 'Enjoys With 2',
    'enjoys_with_3': 'Enjoys With 3',
    'struggles_with_1': 'Struggles With 1',
    'struggles_with_2': 'Struggles With 2',
    'struggles_with_3': 'Struggles With 3',

    # SOI
    'soi_1': 'SOI 1',
    'soi_2': 'SOI 2',
    'soi_3': 'SOI 3',
    'soi_4': 'SOI 4',
    'soi_5': 'SOI 5',

    # Values
    'values_1': 'Value 1',
    'values_2': 'Value 2',
    'values_3': 'Value 3',
    'values_4': 'Value 4',

    # Career aspirations
    'career_asp_1': 'Career Asp 1',
    'career_asp_2': 'Career Asp 2',
    'career_asp_3': 'Career Asp 3',
    'career_asp_4': 'Career Asp 4',

    # Abilities
    'ability_1': 'Ability 1',
    'ability_2': 'Ability 2',
    'ability_3': 'Ability 3',
    'ability_4': 'Ability 4',

    # Pathways (suitability index)
    'pathway_1': 'Suitability 1',
    'pathway_2': 'Suitability 2',
    'pathway_3': 'Suitability 3',
    'pathway_4': 'Suitability 4',
    'pathway_5': 'Suitability 5',
    'pathway_6': 'Suitability 6',
    'pathway_7': 'Suitability 7',
    'pathway_8': 'Suitability 8',
    'pathway_9': 'Suitability 9',

    # Pathway text
    'pathway_1_text': 'Pathway 1 Text',
    'pathway_2_text': 'Pathway 2 Text',
    'pathway_3_text': 'Pathway 3 Text',

    # CP1 details
    'cp1_subjects': 'Pathway 1 Subjects',
    'cp1_skills': 'Pathway 1 Skills',
    'cp1_courses': 'Pathway 1 Courses',
    'cp1_exams': 'Pathway 1 Exams',
    'cp1_personality_has': 'CP1 Personality Has',
    'cp1_personality_lacks': 'CP1 Personality Lacks',
    'cp1_intelligence_has': 'CP1 Intelligence Has',
    'cp1_intelligence_lacks': 'CP1 Intelligence Lacks',
    'cp1_soi_has': 'CP1 SOI Has',
    'cp1_soi_lacks': 'CP1 SOI Lacks',
    'cp1_ability_has': 'CP1 Ability Has',
    'cp1_ability_lacks': 'CP1 Ability Lacks',
    'cp1_values_has': 'CP1 Value Has',
    'cp1_values_lacks': 'CP1 Value Lacks',

    # CP2 details
    'cp2_subjects': 'Pathway 2 Subjects',
    'cp2_skills': 'Pathway 2 Skills',
    'cp2_courses': 'Pathway 2 Courses',
    'cp2_exams': 'Pathway 2 Exams',
    'cp2_personality_has': 'CP2 Personality Has',
    'cp2_personality_lacks': 'CP2 Personality Lacks',
    'cp2_intelligence_has': 'CP2 Intelligence Has',
    'cp2_intelligence_lacks': 'CP2 Intelligence Lacks',
    'cp2_soi_has': 'CP2 SOI Has',
    'cp2_soi_lacks': 'CP2 SOI Lacks',
    'cp2_ability_has': 'CP2 Ability Has',
    'cp2_ability_lacks': 'CP2 Ability Lacks',
    'cp2_values_has': 'CP2 Value Has',
    'cp2_values_lacks': 'CP2 Value Lacks',

    # CP3 details
    'cp3_subjects': 'Pathway 3 Subjects',
    'cp3_skills': 'Pathway 3 Skills',
    'cp3_courses': 'Pathway 3 Courses',
    'cp3_exams': 'Pathway 3 Exams',
    'cp3_personality_has': 'CP3 Personality Has',
    'cp3_personality_lacks': 'CP3 Personality Lacks',
    'cp3_intelligence_has': 'CP3 Intelligence Has',
    'cp3_intelligence_lacks': 'CP3 Intelligence Lacks',
    'cp3_soi_has': 'CP3 SOI Has',
    'cp3_soi_lacks': 'CP3 SOI Lacks',
    'cp3_ability_has': 'CP3 Ability Has',
    'cp3_ability_lacks': 'CP3 Ability Lacks',
    'cp3_values_has': 'CP3 Value Has',
    'cp3_values_lacks': 'CP3 Value Lacks',

    # Future suggestions
    'can_at_school': 'Future Suggestions At School',
    'can_at_home': 'Future Suggestions At Home',

    # AI summaries & misc
    'summary': 'AI_Summary',
    'learning_style': 'Learning_Style_Summary',
    'recommendations': 'Recommendations',
    'weak_ability': 'Weak_Ability',
    'result': 'Career_Match_Result',

    # Graph placeholders (images embedded as base64 or paths)
    'personality_graph': 'personality_graph',
    'intelligence_graph': 'intelligence_graph',
}


# ============================================================================
# VERIFY PREREQUISITES
# ============================================================================
print("Verifying prerequisites...")

missing_critical = False
for class_group, template_path in templates.items():
    if os.path.exists(template_path):
        print(f"  \u2705 {class_group} template: {template_path}")
    else:
        print(f"  \u26a0\ufe0f  Missing template: {template_path}")
        if class_group in ['9-10', '11-12']:
            missing_critical = True

if missing_critical:
    print("  \u274c Critical templates missing. Cannot proceed.")
    exit(1)

if not os.path.exists(INPUT_FILE):
    print(f"  \u274c Master file not found: {INPUT_FILE}")
    exit(1)

df = pd.read_excel(INPUT_FILE, sheet_name='Master_Sheet')
print(f"  \u2705 Master_Sheet loaded: {len(df)} students")

# ============================================================================
# CATEGORIZE STUDENTS BY CLASS
# ============================================================================
print("\nCategorizing students by class group...")

students_by_group = {
    '6-8': [],
    '9-10': [],
    '11-12': [],
}

for idx, row in df.iterrows():
    name = row['Name']
    class_num = int(row['Class'])

    if class_num in [6, 7, 8]:
        students_by_group['6-8'].append(idx)
        print(f"  {name} (Class {class_num}) \u2192 6-8 group")
    elif class_num in [9, 10]:
        students_by_group['9-10'].append(idx)
        print(f"  {name} (Class {class_num}) \u2192 9-10 group")
    elif class_num in [11, 12]:
        students_by_group['11-12'].append(idx)
        print(f"  {name} (Class {class_num}) \u2192 11-12 group")
    else:
        print(f"  \u26a0\ufe0f {name} (Class {class_num}) \u2192 Skipped (Only Class 6-8, 9-10 & 11-12 supported)")

print()
for grp, indices in students_by_group.items():
    print(f"  Class {grp}: {len(indices)} students")


# ============================================================================
# HELPER: Replace placeholders in template
# ============================================================================
def get_value(row, placeholder):
    """Get the value for a placeholder from the student row."""
    col = PLACEHOLDER_MAP.get(placeholder)
    if col and col in row.index:
        val = row[col]
        if pd.isna(val):
            return ''
        val = str(val)
        # Image placeholders: wrap filename in <img> tag
        if '_image' in placeholder and val and not val.startswith('<'):
            img_path = val if val.startswith(('images/', 'assets/', 'http', '/')) else f'images/{val}'
            alt_text = placeholder.replace('_', ' ').title()
            val = f'<img src="{img_path}" style="width: 100%; max-width: 200px;" alt="{alt_text}">'
        return val
    # Graph placeholders - return empty if not available
    if placeholder in ('personality_graph', 'intelligence_graph'):
        return ''
    return ''


def generate_report(row, template_content):
    """Replace all {{ placeholder }} occurrences in the template with student data."""
    report = template_content

    def replacer(match):
        placeholder = match.group(1).strip()
        return get_value(row, placeholder)

    # Match {{ placeholder }} with optional whitespace
    report = re.sub(r'\{\{([^}]+)\}\}', replacer, report)
    return report


# ============================================================================
# GENERATE REPORTS
# ============================================================================
print("\n" + "=" * 70)
print("Generating reports...")
print()

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Copy assets/ and images/ folders to output directory so HTML reports can find them
for folder in ['assets', 'images']:
    src_folder = os.path.join(TEMPLATE_DIR, folder)
    dst_folder = os.path.join(OUTPUT_DIR, folder)
    if os.path.isdir(src_folder):
        if os.path.exists(dst_folder):
            shutil.rmtree(dst_folder)
        shutil.copytree(src_folder, dst_folder)
        print(f"  Copied {folder}/ to output directory")
    else:
        print(f"  Warning: {folder}/ not found in template directory")
print()

total_generated = 0
total_failed = 0

for class_group, student_indices in students_by_group.items():
    if not student_indices:
        print(f"Skipping {class_group} (no students)")
        continue

    template_path = templates[class_group]
    if not os.path.exists(template_path):
        print(f"  \u26a0\ufe0f Skipping {class_group} (template not found)")
        continue

    report_type = report_names[class_group]
    print(f"Generating {class_group} reports ({report_type})...")

    with open(template_path, 'r', encoding='utf-8') as f:
        template_content = f.read()

    for idx in student_indices:
        row = df.loc[idx]
        name = str(row['Name']).strip()

        try:
            report_html = generate_report(row, template_content)

            safe_name = re.sub(r'[^\w\s-]', '', name).strip().replace(' ', '_')
            filename = f"Career-9_{safe_name}_{report_type}.html"
            filepath = os.path.join(OUTPUT_DIR, filename)

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(report_html)

            size_kb = os.path.getsize(filepath) / 1024
            print(f"  \u2705 {name} \u2192 {filename} ({size_kb:.1f} KB)")
            total_generated += 1

        except Exception as e:
            print(f"  \u274c {name} \u2192 Failed: {e}")
            total_failed += 1

    print()

# ============================================================================
# SUMMARY
# ============================================================================
print("=" * 70)
print("REPORT GENERATION SUMMARY")
print("=" * 70)
print(f"\u2705 Successfully generated: {total_generated} reports")
if total_failed > 0:
    print(f"\u274c Failed: {total_failed} reports")
print()
print(f"Output directory: {OUTPUT_DIR}")
print()

# List generated files
try:
    if os.path.exists(OUTPUT_DIR):
        files = [f for f in os.listdir(OUTPUT_DIR) if f.endswith('.html') and not f.startswith('~$')]
        print(f"Generated Reports ({len(files)}):")
        for file in sorted(files):
            size_kb = os.path.getsize(os.path.join(OUTPUT_DIR, file)) / 1024
            print(f"  \u2022 {file} ({size_kb:.1f} KB)")
except Exception as e:
    print(f"\u26a0\ufe0f Could not list report files: {e}")

print()
print(f"\u2705 Phase 6 Complete!")
print(f"   Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 70)
