#!/usr/bin/env python3
"""
Phase 5: Data Enrichment
Enriches master sheet with all JSON data and prepares for report generation
Combines: report_data_mapper + all fixes
Input: suitability_index sheet with analysis and AI summaries
Output: Master_Sheet with 200+ columns, all report placeholders filled
"""

import pandas as pd
import json
import os
import re
import sys
from typing import List
from datetime import datetime

class Colors:
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'

print("=" * 70)
print("PHASE 5: DATA ENRICHMENT")
print("=" * 70)
print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()

# ============================================================================
# LOAD ALL JSON DATA
# ============================================================================
print("Loading JSON data...")

json_data = {}
json_files = {
    'personality': 'data/personality_data.json',
    'intelligence': 'data/intelligence_data.json', 
    'career_pathways': 'data/career_pathways.json',
    'ability': 'data/ability_data.json'
}

for key, file_path in json_files.items():
    with open(file_path, 'r') as f:
        data = json.load(f)
        json_data[key] = data[key] if key in data else data
    print(f"  ✅ Loaded {key} data")

# ============================================================================
# LOAD MASTER SHEET
# ============================================================================
print("\nLoading master sheet...")

INPUT_FILE = "input.xlsx"
df = pd.read_excel(INPUT_FILE, sheet_name='suitability_index')

print(f"  ✅ Loaded {len(df)} students with {len(df.columns)} columns")

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_class_group(class_num):
    """Map class to group"""
    if 6 <= class_num <= 8:
        return "6-8"
    elif 9 <= class_num <= 10:
        return "9-10"
    elif 11 <= class_num <= 12:
        return "11-12"
    else:
        return "9-10"  # Default fallback

def normalize_word(word):
    """Normalize for comparison"""
    if isinstance(word, dict):
        return word.get('english', '').strip()
    return str(word).strip()

# Pathway name mapping
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

# ============================================================================
# DATA QUALITY VALIDATION
# ============================================================================

ALLOWED_BLANK_PATTERNS = [
    re.compile(r"^CP[1-3]\s.+\s(Has|Lacks)$"),
    re.compile(r"^Recommendations$"),
]

COMMON_REQUIRED_FIELDS = [
    'Name', 'Name_Caps', 'First Name', 'Class', 'School',
    'AI_Summary', 'Learning_Style_Summary', 'Learning Style Summary',
    'Personality 1 Text', 'Personality 2 Text', 'Personality 3 Text',
    'Personality 1 Image', 'Personality 2 Image', 'Personality 3 Image',
    'Intelligence 1 Text', 'Intelligence 2 Text', 'Intelligence 3 Text',
    'Intelligence 1 Image', 'Intelligence 2 Image', 'Intelligence 3 Image',
    'Learning Style 1', 'Learning Style 2', 'Learning Style 3',
    'Enjoys With 1', 'Enjoys With 2', 'Enjoys With 3',
    'Struggles With 1', 'Struggles With 2', 'Struggles With 3',
    'Ability 1', 'Ability 2', 'Ability 3', 'Ability 4', 'Ability 5',
    'Value 1', 'Value 2', 'Value 3', 'Value 4', 'Value 5',
    'Suitability 1', 'Suitability 2', 'Suitability 3',
    'Pathway 1 Text', 'Pathway 2 Text', 'Pathway 3 Text',
    'Pathway 1 Subjects', 'Pathway 2 Subjects', 'Pathway 3 Subjects',
    'Pathway 1 Skills', 'Pathway 2 Skills', 'Pathway 3 Skills',
    'Pathway 1 Courses', 'Pathway 2 Courses', 'Pathway 3 Courses',
    'Pathway 1 Exams', 'Pathway 2 Exams', 'Pathway 3 Exams',
    'Future Suggestions At School', 'Future Suggestions At Home',
    'Recommendations', 'Weak_Ability'
    # Note: Career_Match_Result is not in COMMON_REQUIRED_FIELDS because
    # it's only created in Phase 3, which is skipped for 6-8 students
]

REQUIRED_BY_GROUP = {
    "6-8": COMMON_REQUIRED_FIELDS + [
        'SOI 1', 'SOI 2', 'SOI 3',
        # Note: 6-8 students don't have career aspirations (Phase 3 is skipped)
        # Note: 6-8 students only have top 3 suitability (not 4-9)
        # Note: Career_Match_Result is not required for 6-8 (Phase 3 skipped)
    ],
    "9-10": COMMON_REQUIRED_FIELDS + [
        'SOI 1', 'SOI 2', 'SOI 3',
        'Career Asp 1', 'Career Asp 2', 'Career Asp 3', 'Career Asp 4',
        'Suitability 4', 'Suitability 5', 'Suitability 6',
        'Suitability 7', 'Suitability 8', 'Suitability 9',
        'Career_Match_Result'  # Required for 9-10 (Phase 3 runs)
    ],
    "11-12": COMMON_REQUIRED_FIELDS + [
        'SOI 1', 'SOI 2', 'SOI 3',
        'Career Asp 1', 'Career Asp 2', 'Career Asp 3', 'Career Asp 4',
        'Suitability 4', 'Suitability 5', 'Suitability 6',
        'Suitability 7', 'Suitability 8', 'Suitability 9',
        'Career_Match_Result'  # Required for 11-12 (Phase 3 runs)
    ]
}

OPTIONAL_BY_GROUP = {
    "6-8": [
        'SOI 4', 'SOI 5',
        'Value 2', 'Value 3', 'Value 4', 'Value 5',
        'Career_Match_Result'  # Phase 3 is skipped for 6-8, so this won't exist
    ],
    "9-10": [
        'SOI 4', 'SOI 5',
        'Career Asp 3', 'Career Asp 4',
        'Value 2', 'Value 3', 'Value 4', 'Value 5'
    ],
    "11-12": [
        'SOI 4', 'SOI 5',
        'Career Asp 3', 'Career Asp 4',
        'Value 2', 'Value 3', 'Value 4', 'Value 5'
    ]
}

def is_allowed_blank(column_name: str) -> bool:
    for pattern in ALLOWED_BLANK_PATTERNS:
        if pattern.match(column_name):
            return True
    return False

def validate_report_fields(df: pd.DataFrame):
    """Ensure all fields required by report templates are filled."""
    missing_by_field = {}
    missing_columns = []

    for idx, row in df.iterrows():
        class_group = get_class_group(row['Class'])
        required_fields = required_fields_for_group(class_group)
        optional_fields = set(optional_fields_for_group(class_group))

        for field in required_fields:
            if field not in df.columns:
                if field not in missing_columns:
                    missing_columns.append(field)
                continue

            value = row.get(field, "")
            if pd.isna(value) or str(value).strip() == "":
                if field in optional_fields or is_allowed_blank(field):
                    continue
                student_name = row.get('Name', f'Row {idx + 1}')
                missing_by_field.setdefault(field, set()).add(student_name)

    if missing_columns or missing_by_field:
        issues = []
        if missing_columns:
            issues.append({
                'type': 'missing_columns',
                'columns': sorted(missing_columns)
            })
        if missing_by_field:
            issues.append({
                'type': 'missing_values',
                'details': [
                    {
                        'field': field,
                        'students': sorted(list(students))
                    }
                    for field, students in missing_by_field.items()
                ]
            })

        payload = {
            'issues': issues,
            'rows': len(df)
        }
        with open('phase5_data_quality_errors.json', 'w') as f:
            json.dump(payload, f, indent=2)

        print(f"{Colors.RED}❌ Data quality validation failed in Phase 5.{Colors.END}")
        print(f"{Colors.RED}   See phase5_data_quality_errors.json for details.{Colors.END}")
        sys.exit(1)
    else:
        print(f"{Colors.GREEN}  ✅ All mandatory report fields are populated.{Colors.END}")

def required_fields_for_group(class_group: str) -> List[str]:
    if class_group in REQUIRED_BY_GROUP:
        return REQUIRED_BY_GROUP[class_group]
    return COMMON_REQUIRED_FIELDS

def optional_fields_for_group(class_group: str) -> List[str]:
    return OPTIONAL_BY_GROUP.get(class_group, [])

# ============================================================================
# ENRICHMENT 1: BASIC INFO
# ============================================================================
print("\n1. Adding basic info columns...")

df['Name_Caps'] = df['Name'].str.upper()
df['First Name'] = df['Name'].str.split().str[0]
df['Roll Number'] = df.get('Roll Number', '')
df['Father Name'] = df.get('Father Name', '')
df['Mother Name'] = df.get('Mother Name', '')

print("  ✅ Basic info added")

# ============================================================================
# ENRICHMENT 2: PERSONALITY TEXT & IMAGES
# ============================================================================
print("\n2. Adding personality text and images...")

for i in range(1, 4):
    text_col = f"Personality {i} Text"
    image_col = f"Personality {i} Image"
    
    df[text_col] = ""
    df[image_col] = ""
    
    for idx, row in df.iterrows():
        class_group = get_class_group(row['Class'])
        personality = row.get(f'Personality_Top{i}', '')
        
        if personality and str(personality).strip():
            trait_key = personality.lower().replace(' ', '_')
            
            if trait_key in json_data['personality']:
                trait_data = json_data['personality'][trait_key]
                
                # Get description
                if 'descriptions' in trait_data and class_group in trait_data['descriptions']:
                    df.at[idx, text_col] = trait_data['descriptions'][class_group]['english']
                
                # Get image
                if 'titleImage' in trait_data:
                    df.at[idx, image_col] = trait_data['titleImage']['english']

print("  ✅ Personality text and images added")

# ============================================================================
# ENRICHMENT 3: INTELLIGENCE TEXT & IMAGES
# ============================================================================
print("\n3. Adding intelligence text and images...")

for i in range(1, 4):
    text_col = f"Intelligence {i} Text"
    image_col = f"Intelligence {i} Image"
    
    df[text_col] = ""
    df[image_col] = ""
    
    for idx, row in df.iterrows():
        class_group = get_class_group(row['Class'])
        intelligence = row.get(f'Intelligence_Top{i}', '')
        
        if intelligence and str(intelligence).strip():
            intel_key = intelligence.lower().replace('-', '_').replace(' ', '_')

            # Canonicalize common aliases to JSON keys
            # Logical-Mathematical → logical (JSON stores as 'logical')
            if 'logical' in intel_key:
                intel_key = 'logical'
            # Spatial-Visual → visual_spatial (JSON key is 'visual_spatial')
            if intel_key == 'spatial_visual':
                intel_key = 'visual_spatial'
            
            if intel_key in json_data['intelligence']:
                intel_data = json_data['intelligence'][intel_key]
                
                # Get description
                if 'descriptions' in intel_data and class_group in intel_data['descriptions']:
                    df.at[idx, text_col] = intel_data['descriptions'][class_group]['english']
                
                # Get image
                if 'titleImage' in intel_data:
                    df.at[idx, image_col] = intel_data['titleImage']['english']

print("  ✅ Intelligence text and images added")

# ============================================================================
# ENRICHMENT 4: LEARNING STYLE DETAILS
# ============================================================================
print("\n4. Adding learning style details...")

# Check if Learning_Style columns exist, if not create them from Intelligence_Top
intelligence_to_learning_style = {
    'Bodily-Kinesthetic': 'Body smart',
    'Musical': 'Rhythmic',
    'Intrapersonal': 'Self-aware',
    'Interpersonal': 'Interactive',
    'Naturalistic': 'Nature smart',
    'Linguistic': 'Word smart',
    'Logical-Mathematical': 'Logic smart',
    'Visual-Spatial': 'Picture smart',
    'Spatial-Visual': 'Picture smart',
    'Logical': 'Logic smart'  # Handle variant
}

# Create Learning_Style columns if they don't exist
for i in range(1, 4):
    if f'Learning_Style_{i}' not in df.columns:
        # Try to create from Intelligence_Top columns
        intel_col = f'Intelligence_Top{i}'
        if intel_col in df.columns:
            df[f'Learning_Style_{i}'] = df[intel_col].map(intelligence_to_learning_style).fillna('')
            print(f"  ✅ Created Learning_Style_{i} from {intel_col}")
        else:
            # Create empty column if Intelligence_Top doesn't exist either
            df[f'Learning_Style_{i}'] = ''
            print(f"  {Colors.YELLOW}⚠️  Learning_Style_{i} and {intel_col} not found, creating empty column{Colors.END}")

# Rename columns
for i in range(1, 4):
    if f'Learning_Style_{i}' in df.columns:
        df[f'Learning Style {i}'] = df[f'Learning_Style_{i}']

if 'Learning_Style_Summary' in df.columns:
    df['Learning Style Summary'] = df['Learning_Style_Summary']

# Add enjoys/struggles mapping
enjoys_mapping = {
    'Body smart': 'Physical activities and hands-on learning',
    'Rhythmic': 'Music, rhythm, and patterns in learning',
    'Self-aware': 'Independent study and self-reflection',
    'Interactive': 'Group discussions and collaborative learning',
    'Nature smart': 'Outdoor learning and nature-based activities',
    'Word smart': 'Reading, writing, and verbal expression',
    'Logic smart': 'Problem-solving and analytical thinking',
    'Picture smart': 'Visual learning and spatial reasoning'
}

struggles_mapping = {
    'Body smart': 'Sitting still for long periods',
    'Rhythmic': 'Learning without patterns or structure',
    'Self-aware': 'Large group activities without personal space',
    'Interactive': 'Solo work without social interaction',
    'Nature smart': 'Indoor, abstract learning environments',
    'Word smart': 'Non-verbal or visual-only tasks',
    'Logic smart': 'Unstructured or ambiguous tasks',
    'Picture smart': 'Purely auditory learning'
}

for i in range(1, 4):
    enjoys_col = f'Enjoys With {i}'
    struggles_col = f'Struggles With {i}'
    
    # Use Learning_Style if it exists, otherwise use empty string
    if f'Learning_Style_{i}' in df.columns:
        df[enjoys_col] = df[f'Learning_Style_{i}'].map(enjoys_mapping).fillna('')
        df[struggles_col] = df[f'Learning_Style_{i}'].map(struggles_mapping).fillna('')
    else:
        df[enjoys_col] = ''
        df[struggles_col] = ''

print("  ✅ Learning style details added")

# ============================================================================
# ENRICHMENT 5: RENAME SOI AND CAREER ASPIRATIONS
# ============================================================================
print("\n5. Renaming SOI and Career Aspiration columns...")

for i in range(1, 6):
    if f'Subject Of Interest {i}' in df.columns:
        df[f'SOI {i}'] = df[f'Subject Of Interest {i}']

for i in range(1, 5):
    if f'Career Aspiration {i}' in df.columns:
        df[f'Career Asp {i}'] = df[f'Career Aspiration {i}']

print("  ✅ Columns renamed")

# ============================================================================
# ENRICHMENT 6: RENAME ABILITIES
# ============================================================================
print("\n6. Renaming ability columns...")

for i in range(1, 6):
    if f'Ability_Top{i}' in df.columns:
        df[f'Ability {i}'] = df[f'Ability_Top{i}']

print("  ✅ Ability columns renamed")

# ============================================================================
# ENRICHMENT 7: PATHWAY DETAILS (Description, Subjects, Skills, Courses, Exams)
# ============================================================================
print("\n7. Adding pathway details (description, subjects, skills, courses, exams)...")

for i in range(1, 10):
    # Rename suitability_index to Suitability
    if f'suitability_index_{i}' in df.columns:
        df[f'Suitability {i}'] = df[f'suitability_index_{i}']

# Add details for top 3 pathways
for i in range(1, 4):
    text_col = f"Pathway {i} Text"
    subjects_col = f"Pathway {i} Subjects"
    skills_col = f"Pathway {i} Skills"
    courses_col = f"Pathway {i} Courses"
    exams_col = f"Pathway {i} Exams"
    
    df[text_col] = ""
    df[subjects_col] = ""
    df[skills_col] = ""
    df[courses_col] = ""
    df[exams_col] = ""
    
    for idx, row in df.iterrows():
        class_group = get_class_group(row['Class'])
        pathway_name = row.get(f'suitability_index_{i}', '')
        
        if pathway_name and str(pathway_name).strip():
            json_key = pathway_mapping.get(pathway_name, pathway_name.lower().replace(' ', '_').replace('/', '_').replace(',', '_').replace('-', '_'))
            
            if json_key in json_data['career_pathways']:
                pathway_data = json_data['career_pathways'][json_key]
                
                # Get class-specific data
                if class_group in pathway_data:
                    class_data = pathway_data[class_group]
                    
                    df.at[idx, text_col] = class_data.get('description', {}).get('english', '')
                    df.at[idx, subjects_col] = class_data.get('subjects', {}).get('english', '')
                    df.at[idx, skills_col] = class_data.get('skills', {}).get('english', '')
                    
                    # Use courses and exams from 9-10 data for all class groups
                    # This ensures consistent detailed course/exam information across all classes
                    courses_9_10 = ''
                    exams_9_10 = ''
                    
                    # Get 9-10 data for the same pathway
                    if '9-10' in pathway_data:
                        class_9_10_data = pathway_data['9-10']
                        courses_9_10 = class_9_10_data.get('courses', {}).get('english', '')
                        exams_9_10 = class_9_10_data.get('exams', {}).get('english', '')
                    
                    # Use 9-10 courses and exams for all class groups
                    df.at[idx, courses_col] = courses_9_10
                    df.at[idx, exams_col] = exams_9_10

print("  ✅ Pathway details added for top 3 pathways")

# ============================================================================
# ENRICHMENT 8: FUTURE SUGGESTIONS
# ============================================================================
print("\n8. Adding future suggestions (from personality)...")

df['Future Suggestions At School'] = ""
df['Future Suggestions At Home'] = ""

for idx, row in df.iterrows():
    class_group = get_class_group(row['Class'])
    top_personality = row.get('Personality_Top1', '')
    
    if top_personality and str(top_personality).strip():
        trait_key = top_personality.lower().replace(' ', '_')
        
        if trait_key in json_data['personality']:
            trait_data = json_data['personality'][trait_key]
            
            if 'futureSuggestions' in trait_data and class_group in trait_data['futureSuggestions']:
                suggestions = trait_data['futureSuggestions'][class_group]
                
                df.at[idx, 'Future Suggestions At School'] = suggestions.get('atSchool', {}).get('english', '')
                df.at[idx, 'Future Suggestions At Home'] = suggestions.get('atHome', {}).get('english', '')

print("  ✅ Future suggestions added")

# ============================================================================
# ENRICHMENT 9: RECOMMENDATIONS (from weak ability)
# ============================================================================
print("\n9. Adding recommendations with bullet points...")

df['Recommendations'] = ""

for idx, row in df.iterrows():
    class_group = get_class_group(row['Class'])
    weak_ability = row.get('Weak_Ability', '')
    
    if weak_ability and str(weak_ability).strip() and str(weak_ability).lower() != 'nan':
        ability_key = weak_ability.lower().replace(' ', '_').replace('&', 'and')
        
        if ability_key in json_data['ability']:
            ability_data = json_data['ability'][ability_key]
            
            # Get class-specific recommendations
            if 'recommendations' in ability_data:
                recs_data = ability_data['recommendations']
                
                # Use 9-12 for both 9-10 and 11-12
                class_group_for_ability = "9-12"
                
                if class_group_for_ability in recs_data:
                    recs_text = recs_data[class_group_for_ability]['english']
                    
                    # Format with bullet points
                    lines = recs_text.split('\n')
                    formatted_lines = []
                    for line in lines:
                        line = line.strip()
                        if line and not line.startswith('•'):
                            formatted_lines.append(f"• {line}")
                        elif line:
                            formatted_lines.append(line)
                    
                    df.at[idx, 'Recommendations'] = '\n'.join(formatted_lines)

print("  ✅ Recommendations added with bullet formatting")

# ============================================================================
# FINAL CLEANUP
# ============================================================================
print("\n10. Final cleanup and formatting...")

# Title case all values in CP Value Has/Lacks columns
value_columns = [col for col in df.columns if 'Value Has' in col or 'Value Lacks' in col]
for col in value_columns:
    df[col] = df[col].apply(lambda x: ', '.join([item.strip().title() for item in str(x).split(',')]) if x and str(x).strip() and str(x).lower() != 'nan' else '')

# Replace NaN and 'nan' strings with empty strings
for col in df.columns:
    df[col] = df[col].apply(lambda x: '' if pd.isna(x) or str(x).lower() == 'nan' else x)

print("  ✅ Data cleaned and formatted")

# ============================================================================
# VALIDATE AND SAVE AS MASTER_SHEET
# ============================================================================
print("\n" + "=" * 70)
print("Saving enriched data as Master_Sheet...")

# Verify Has/Lacks columns are present before saving
has_lacks_cols = [col for col in df.columns if ('Has' in col or 'Lacks' in col) and 'CP' in col]
print(f"  📊 Has/Lacks columns to save: {len(has_lacks_cols)}")
if len(has_lacks_cols) > 0:
    print(f"  ✅ Sample: {sorted(has_lacks_cols)[:3]}")
else:
    print(f"  ⚠️  WARNING: No Has/Lacks columns found in dataframe!")

# Run data quality validation (fails fast if required fields missing)
validate_report_fields(df)

with pd.ExcelWriter(INPUT_FILE, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
    df.to_excel(writer, sheet_name='Master_Sheet', index=False)

print(f"✅ Phase 5 Complete!")
print(f"   Created Master_Sheet with {len(df.columns)} columns")
print(f"   All report placeholders populated")
print(f"   Students processed: {len(df)}")
print(f"   Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 70)