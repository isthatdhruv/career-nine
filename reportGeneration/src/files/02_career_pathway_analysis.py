#!/usr/bin/env python3
"""
Phase 2: Career Pathway Analysis
Analyzes top 3 career pathways for each student
Generates Has/Lacks for ALL 5 attributes: Personality, Intelligence, SOI, Abilities, Values
Input: suitability_index sheet
Output: suitability_index sheet WITH CP1-3 Has/Lacks columns
"""

import pandas as pd
import json
import re
from datetime import datetime

print("=" * 70)
print("PHASE 2: CAREER PATHWAY ANALYSIS")
print("=" * 70)
print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()

# ============================================================================
# LOAD DATA
# ============================================================================
print("Loading data...")

INPUT_FILE = "input.xlsx"
df = pd.read_excel(INPUT_FILE, sheet_name='suitability_index')

with open('data/career_pathways.json', 'r') as f:
    career_pathways_data = json.load(f)['career_pathways']

print(f"  ✅ Loaded {len(df)} students")
print(f"  ✅ Loaded {len(career_pathways_data)} career pathways")

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_class_group(class_num):
    """Map class number to class group"""
    if 6 <= class_num <= 8:
        return "6-8"
    elif 9 <= class_num <= 10:
        return "9-10"
    elif 11 <= class_num <= 12:
        return "11-12"
    else:
        return "9-10"

CANONICAL_MAP = {
    'logical': 'logical',
    'logical-mathematical': 'logical',
    'logical mathematical': 'logical',
    'logical/mathematical': 'logical',
    'logical-mathematics': 'logical',
    'visual-spatial': 'visual-spatial',
    'visual spatial': 'visual-spatial',
    'spatial-visual': 'visual-spatial',
    'spatial visual': 'visual-spatial',
    'bodily-kinesthetic': 'bodily-kinesthetic',
    'bodily kinesthetic': 'bodily-kinesthetic',
    'bodily/kinesthetic': 'bodily-kinesthetic',
    'intra personal': 'intrapersonal',
    'inter personal': 'interpersonal',
    'self aware': 'self-aware',
    'self-aware': 'self-aware',
    'rhythmic': 'rhythmic',
    'music smart': 'musical',
    'picture smart': 'visual-spatial',
    'body smart': 'bodily-kinesthetic',
}

DISPLAY_ALIASES = {
    'logical': 'Logical-Mathematical',
    'visual-spatial': 'Visual-Spatial',
    'bodily-kinesthetic': 'Bodily-Kinesthetic',
    'self-aware': 'Self-Aware',
    'musical': 'Musical',
    'intrapersonal': 'Intrapersonal',
    'interpersonal': 'Interpersonal',
    'linguistic': 'Linguistic',
    'rhythmic': 'Rhythmic',
}

def normalize_word(word):
    """Normalize word for comparison (handles English/Hindi pairs)"""
    if isinstance(word, dict):
        word = word.get('english', word.get('hindi', ''))
    normalized = str(word).lower().strip()
    normalized = normalized.replace('’', "'")
    normalized_no_punct = re.sub(r'[_/-]+', ' ', normalized)
    normalized_no_punct = re.sub(r'\s+', ' ', normalized_no_punct).strip()

    if normalized in CANONICAL_MAP:
        return CANONICAL_MAP[normalized]
    if normalized_no_punct in CANONICAL_MAP:
        return CANONICAL_MAP[normalized_no_punct]
    return normalized_no_punct

# Personality mapping: RIASEC codes to display names
personality_display_mapping = {
    'realistic': 'doer',
    'investigative': 'thinker',
    'artistic': 'creator',
    'social': 'helper',
    'enterprising': 'persuader',
    'conventional': 'organizer'
}

def convert_personality_to_display(personality):
    """Convert RIASEC personality code to display name"""
    if not personality:
        return ''
    normalized = normalize_word(personality)
    return personality_display_mapping.get(normalized, normalized)

pathway_mapping = {
    'Paramedical': 'paramedical',
    'Environmental Service': 'environmental_service',
    'Life Sciences /Medicine and Healthcare': 'life_sciences_medicine_and_healthcare',
    'Agriculture, Food Industry and Forestry': 'agriculture_food_industry_and_forestry',
    'Education and Training': 'education_and_training',
    'Community and Social Service': 'community_and_social_service',
    'Hospitality and Tourism': 'hospitality_and_tourism',
    'Personal Care and Services': 'personal_care_and_services',
    'Social Sciences and Humanities': 'social_sciences_and_humanities',
    'Computer Science, IT and Allied Fields': 'computer_science_it_and_allied_fields',
    'Science and Mathematics': 'science_and_mathematics',
    'Engineering and Technology': 'engineering_and_technology',
    'Government and Public Administration': 'government_and_public_administration',
    'Defence/ Protective Service': 'defence_protective_service',
    'Sports': 'sports',
    'Banking and Finance': 'banking_and_finance',
    'Law Studies': 'law_studies',
    'Marketing': 'marketing',
    'Entrepreneurship': 'entrepreneurship',
    'Sales': 'sales',
    'Architecture': 'architecture',
    'Art Design': 'art_design',
    'Art, Design': 'art_design',  # Handle comma variant
    'Entertainment and Mass Media': 'entertainment_and_mass_media',
    'Management and Administration': 'management_and_administration'
}

def get_pathway_requirements(pathway_name, class_group):
    """Get all requirements for a pathway"""
    json_key = pathway_mapping.get(pathway_name, pathway_name.lower().replace(' ', '_').replace('/', '_').replace(',', '_').replace('-', '_'))
    
    if json_key not in career_pathways_data:
        return [], [], [], [], []
    
    pathway_data = career_pathways_data[json_key]
    
    # Get top-level requirements (not class-specific)
    # Keep personality as dicts/objects to extract display names
    personality_req = pathway_data.get('personality_types', [])
    
    # Handle intelligence requirements - they can be strings or dicts, and may contain comma-separated values
    intelligence_req_raw = pathway_data.get('intelligence_types', [])
    intelligence_req = []
    for intel in intelligence_req_raw:
        if isinstance(intel, dict):
            intel_str = intel.get('english', intel.get('hindi', ''))
        else:
            intel_str = str(intel)
        
        # Split comma-separated values and normalize each
        for part in intel_str.split(','):
            part = part.strip()
            if part:
                intelligence_req.append(normalize_word(part))
    
    # Deduplicate requirements (some pathways may have duplicates in JSON)
    intelligence_req = list(dict.fromkeys(intelligence_req))
    
    soi_req = [normalize_word(s) for s in pathway_data.get('subjects_of_interest', [])]
    abilities_req = [normalize_word(a) for a in pathway_data.get('abilities', [])]
    values_req = [normalize_word(v) for v in pathway_data.get('values', [])]
    
    return personality_req, intelligence_req, soi_req, abilities_req, values_req

def compare_attributes(student_attrs, required_attrs, is_personality=False):
    """Compare student attributes with requirements"""
    # For personality, convert student RIASEC codes to display names
    if is_personality:
        student_norm = [convert_personality_to_display(a) for a in student_attrs if a and str(a).strip() and str(a).lower() != 'nan']
    else:
        student_norm = [normalize_word(a) for a in student_attrs if a and str(a).strip() and str(a).lower() != 'nan']
    
    has = []
    lacks = []
    
    for req in required_attrs:
        # Get normalized requirement for comparison
        if isinstance(req, dict):
            req_norm = normalize_word(req.get('english', req.get('hindi', '')))
            display_name = req.get('english', req.get('hindi', '')).title()
        else:
            req_norm = normalize_word(req)
            display_name = DISPLAY_ALIASES.get(req_norm, req_norm.title())
        
        found = False
        for student_attr in student_norm:
            # Exact matching only (no partial matching to avoid false positives)
            if req_norm == student_attr:
                has.append(display_name)
                found = True
                break
        
        if not found:
            lacks.append(display_name)
    
    return has, lacks

# ============================================================================
# ANALYZE EACH STUDENT
# ============================================================================
print("\nAnalyzing students...")

for idx, row in df.iterrows():
    name = row['Name']
    class_group = get_class_group(row['Class'])
    
    print(f"\n  {name} (Class {row['Class']} - Group {class_group}):")
    
    # Get student attributes
    student_personality = [row.get(f'Personality_Top{i}', '') for i in range(1, 4)]
    student_intelligence = [row.get(f'Intelligence_Top{i}', '') for i in range(1, 4)]
    student_soi = [row.get(f'Subject Of Interest {i}', '') for i in range(1, 6)]
    student_abilities = [row.get(f'Ability_Top{i}', '') for i in range(1, 6)]
    student_values = [row.get(f'Value {i}', '') for i in range(1, 6)]
    
    # Analyze top 3 career pathways
    for cp_num in range(1, 4):
        pathway_name = row.get(f'suitability_index_{cp_num}', '')
        
        if pathway_name and str(pathway_name).strip() and str(pathway_name).lower() != 'nan':
            print(f"    CP{cp_num}: {pathway_name}")
            
            # Get requirements
            personality_req, intelligence_req, soi_req, abilities_req, values_req = get_pathway_requirements(pathway_name, class_group)
            
            # Compare each attribute (personality needs special handling)
            personality_has, personality_lacks = compare_attributes(student_personality, personality_req, is_personality=True)
            intelligence_has, intelligence_lacks = compare_attributes(student_intelligence, intelligence_req)
            soi_has, soi_lacks = compare_attributes(student_soi, soi_req)
            abilities_has, abilities_lacks = compare_attributes(student_abilities, abilities_req)
            values_has, values_lacks = compare_attributes(student_values, values_req)
            
            # Save to dataframe - deduplicate before joining to avoid duplicates
            df.at[idx, f'CP{cp_num} Personality Has'] = ', '.join(dict.fromkeys(personality_has))
            df.at[idx, f'CP{cp_num} Personality Lacks'] = ', '.join(dict.fromkeys(personality_lacks))
            df.at[idx, f'CP{cp_num} Intelligence Has'] = ', '.join(dict.fromkeys(intelligence_has))
            df.at[idx, f'CP{cp_num} Intelligence Lacks'] = ', '.join(dict.fromkeys(intelligence_lacks))
            df.at[idx, f'CP{cp_num} SOI Has'] = ', '.join(dict.fromkeys(soi_has))
            df.at[idx, f'CP{cp_num} SOI Lacks'] = ', '.join(dict.fromkeys(soi_lacks))
            df.at[idx, f'CP{cp_num} Ability Has'] = ', '.join(dict.fromkeys(abilities_has))
            df.at[idx, f'CP{cp_num} Ability Lacks'] = ', '.join(dict.fromkeys(abilities_lacks))
            df.at[idx, f'CP{cp_num} Value Has'] = ', '.join(dict.fromkeys(values_has))
            df.at[idx, f'CP{cp_num} Value Lacks'] = ', '.join(dict.fromkeys(values_lacks))
            
            print(f"      ✅ Has/Lacks generated for all 5 attributes")

# ============================================================================
# SAVE RESULTS
# ============================================================================
print("\n" + "=" * 70)
print("Saving results...")

with pd.ExcelWriter(INPUT_FILE, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
    df.to_excel(writer, sheet_name='suitability_index', index=False)

print(f"✅ Phase 2 Complete!")
print(f"   Updated suitability_index sheet with CP Has/Lacks for 5 attributes")
print(f"   Students processed: {len(df)}")
print(f"   Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 70)