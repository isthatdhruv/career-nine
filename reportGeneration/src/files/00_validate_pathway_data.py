#!/usr/bin/env python3
"""
Validation Script: Check for Pathway Name Mismatches and Missing Data
Runs after Phase 2 or Phase 5 to ensure:
1. All pathway names are properly mapped
2. Has/Lacks data is generated when pathway descriptions exist
3. No unmapped pathway names exist
4. Data consistency checks
"""

import pandas as pd
import json
from datetime import datetime

print("=" * 70)
print("PATHWAY DATA VALIDATION")
print("=" * 70)
print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()

# ============================================================================
# LOAD DATA
# ============================================================================
INPUT_FILE = "input.xlsx"

print("Loading data...")
df_suitability = pd.read_excel(INPUT_FILE, sheet_name='suitability_index')

# Check if Master_Sheet exists (only created in Phase 5)
xl_file = pd.ExcelFile(INPUT_FILE)
has_master_sheet = 'Master_Sheet' in xl_file.sheet_names

if has_master_sheet:
    df_master = pd.read_excel(INPUT_FILE, sheet_name='Master_Sheet')
    print(f"  ✅ Loaded {len(df_suitability)} students from suitability_index")
    print(f"  ✅ Loaded {len(df_master)} students from Master_Sheet")
else:
    df_master = None
    print(f"  ✅ Loaded {len(df_suitability)} students from suitability_index")
    print(f"  ⚠️  Master_Sheet not found (will skip Master_Sheet validations)")

# Load pathway mapping from both scripts
pathway_mapping_phase2 = {
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

pathway_mapping_phase5 = {
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

# Load JSON to verify pathways exist
with open('data/career_pathways.json', 'r') as f:
    career_pathways_data = json.load(f)['career_pathways']

print(f"  ✅ Loaded {len(career_pathways_data)} pathways from JSON")
print()

# ============================================================================
# VALIDATION 1: Check for Unmapped Pathway Names
# ============================================================================
print("=" * 70)
print("VALIDATION 1: Checking for Unmapped Pathway Names")
print("=" * 70)

all_pathway_names = set()
for i in range(1, 4):
    col = f'suitability_index_{i}'
    if col in df_suitability.columns:
        pathways = df_suitability[col].dropna().unique()
        all_pathway_names.update([str(p).strip() for p in pathways if p and str(p).strip().lower() != 'nan'])

unmapped_pathways = []
for pathway_name in sorted(all_pathway_names):
    if pathway_name not in pathway_mapping_phase2:
        unmapped_pathways.append(pathway_name)

if unmapped_pathways:
    print(f"❌ Found {len(unmapped_pathways)} unmapped pathway names:")
    for pathway in unmapped_pathways:
        print(f"  • '{pathway}'")
        # Count how many students have this pathway
        count = 0
        for i in range(1, 4):
            col = f'suitability_index_{i}'
            if col in df_suitability.columns:
                count += len(df_suitability[df_suitability[col] == pathway])
        print(f"    → Affects {count} student(s)")
    print()
    print("⚠️  ACTION REQUIRED: Add these pathway names to mapping in:")
    print("     - 02_career_pathway_analysis.py (pathway_mapping)")
    print("     - 05_data_enrichment.py (pathway_mapping)")
else:
    print("✅ All pathway names are mapped")
print()

# ============================================================================
# VALIDATION 2: Check Pathway Name Consistency Between Phase 2 and Phase 5
# ============================================================================
print("=" * 70)
print("VALIDATION 2: Checking Pathway Mapping Consistency")
print("=" * 70)

phase2_only = set(pathway_mapping_phase2.keys()) - set(pathway_mapping_phase5.keys())
phase5_only = set(pathway_mapping_phase5.keys()) - set(pathway_mapping_phase2.keys())

if phase2_only:
    print(f"❌ Pathways in Phase 2 but not Phase 5: {sorted(phase2_only)}")
if phase5_only:
    print(f"❌ Pathways in Phase 5 but not Phase 2: {sorted(phase5_only)}")

if not phase2_only and not phase5_only:
    print("✅ Pathway mappings are consistent between Phase 2 and Phase 5")
print()

# ============================================================================
# VALIDATION 3: Check Has/Lacks Data Generation
# ============================================================================
print("=" * 70)
print("VALIDATION 3: Checking Has/Lacks Data Generation")
print("=" * 70)

issues_found = []
for idx, row in df_suitability.iterrows():
    student_name = row['Name']
    
    for cp_num in range(1, 4):
        pathway_name = row.get(f'suitability_index_{cp_num}', '')
        
        if not pathway_name or str(pathway_name).strip().lower() == 'nan':
            continue
        
        # Check if pathway is mapped
        if pathway_name not in pathway_mapping_phase2:
            continue
        
        json_key = pathway_mapping_phase2[pathway_name]
        
        # Check if pathway exists in JSON
        if json_key not in career_pathways_data:
            issues_found.append({
                'student': student_name,
                'cp': f'CP{cp_num}',
                'pathway': pathway_name,
                'issue': f'Pathway "{pathway_name}" mapped to "{json_key}" but not found in JSON'
            })
            continue
        
        # Check Has/Lacks columns
        has_cols = [
            f'CP{cp_num} Personality Has',
            f'CP{cp_num} Intelligence Has',
            f'CP{cp_num} SOI Has',
            f'CP{cp_num} Ability Has',
            f'CP{cp_num} Value Has'
        ]
        
        lacks_cols = [
            f'CP{cp_num} Personality Lacks',
            f'CP{cp_num} Intelligence Lacks',
            f'CP{cp_num} SOI Lacks',
            f'CP{cp_num} Ability Lacks',
            f'CP{cp_num} Value Lacks'
        ]
        
        # Check if ALL Has and Lacks columns are empty (this is suspicious)
        all_has_empty = all([
            pd.isna(row.get(col, '')) or 
            str(row.get(col, '')).strip() == '' or 
            str(row.get(col, '')).lower() == 'nan'
            for col in has_cols
        ])
        
        all_lacks_empty = all([
            pd.isna(row.get(col, '')) or 
            str(row.get(col, '')).strip() == '' or 
            str(row.get(col, '')).lower() == 'nan'
            for col in lacks_cols
        ])
        
        if all_has_empty and all_lacks_empty:
            issues_found.append({
                'student': student_name,
                'cp': f'CP{cp_num}',
                'pathway': pathway_name,
                'issue': f'All Has/Lacks columns are empty (may indicate Phase 2 failed for this pathway)'
            })

if issues_found:
    print(f"❌ Found {len(issues_found)} Has/Lacks data issues:")
    for issue in issues_found[:10]:  # Show first 10
        print(f"  • {issue['student']} - {issue['cp']} ({issue['pathway']}): {issue['issue']}")
    if len(issues_found) > 10:
        print(f"  ... and {len(issues_found) - 10} more issues")
else:
    print("✅ All Has/Lacks data appears to be generated correctly")
print()

# ============================================================================
# VALIDATION 4: Check Pathway Description vs Has/Lacks Consistency
# ============================================================================
print("=" * 70)
print("VALIDATION 4: Checking Pathway Description vs Has/Lacks Consistency")
print("=" * 70)

issues_found_desc = []
if df_master is not None:
    for idx, row in df_master.iterrows():
        student_name = row['Name']
    
    for cp_num in range(1, 4):
        pathway_name = row.get(f'suitability_index_{cp_num}', '')
        pathway_text = row.get(f'Pathway {cp_num} Text', '')
        
        if not pathway_name or str(pathway_name).strip().lower() == 'nan':
            continue
        
        # If pathway has description but no Has/Lacks data, that's suspicious
        has_description = pathway_text and str(pathway_text).strip() and str(pathway_text).lower() != 'nan'
        
        if has_description:
            # Check if at least one Has/Lacks column has data
            has_col = row.get(f'CP{cp_num} Personality Has', '')
            lacks_col = row.get(f'CP{cp_num} Personality Lacks', '')
            
            has_has_lacks = (
                (has_col and str(has_col).strip() and str(has_col).lower() != 'nan') or
                (lacks_col and str(lacks_col).strip() and str(lacks_col).lower() != 'nan')
            )
            
            if not has_has_lacks:
                issues_found_desc.append({
                    'student': student_name,
                    'cp': f'CP{cp_num}',
                    'pathway': pathway_name,
                    'issue': f'Has pathway description but no Has/Lacks data'
                })
else:
    print("⚠️  Skipping Validation 4: Master_Sheet not found (created in Phase 5)")

if df_master is not None:
    if issues_found_desc:
        print(f"❌ Found {len(issues_found_desc)} consistency issues:")
        for issue in issues_found_desc[:10]:
            print(f"  • {issue['student']} - {issue['cp']} ({issue['pathway']}): {issue['issue']}")
        if len(issues_found_desc) > 10:
            print(f"  ... and {len(issues_found_desc) - 10} more issues")
    else:
        print("✅ Pathway descriptions and Has/Lacks data are consistent")
print()

# ============================================================================
# VALIDATION 5: Check JSON Pathway Existence
# ============================================================================
print("=" * 70)
print("VALIDATION 5: Checking All Pathways Exist in JSON")
print("=" * 70)

missing_json_pathways = []
for pathway_name in sorted(all_pathway_names):
    if pathway_name in pathway_mapping_phase2:
        json_key = pathway_mapping_phase2[pathway_name]
        if json_key not in career_pathways_data:
            missing_json_pathways.append((pathway_name, json_key))

if missing_json_pathways:
    print(f"❌ Found {len(missing_json_pathways)} pathways mapped but missing in JSON:")
    for pathway_name, json_key in missing_json_pathways:
        print(f"  • '{pathway_name}' → '{json_key}' (not in JSON)")
else:
    print("✅ All mapped pathways exist in JSON")
print()

# ============================================================================
# SUMMARY
# ============================================================================
print("=" * 70)
print("VALIDATION SUMMARY")
print("=" * 70)

total_issues = len(unmapped_pathways) + len(issues_found) + len(issues_found_desc) + len(missing_json_pathways)

if total_issues == 0:
    print("✅ All validations passed! No issues found.")
    print()
    print("✅ Data is ready for report generation")
else:
    print(f"❌ Found {total_issues} total issues that need attention:")
    print(f"   • {len(unmapped_pathways)} unmapped pathway names")
    print(f"   • {len(issues_found)} Has/Lacks data generation issues")
    print(f"   • {len(issues_found_desc)} description vs Has/Lacks consistency issues")
    print(f"   • {len(missing_json_pathways)} pathways missing in JSON")
    print()
    print("⚠️  Please fix these issues before generating reports")
    print()

print(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 70)