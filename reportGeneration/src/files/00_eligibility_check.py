"""
ELIGIBILITY CHECK FOR REPORT GENERATION
========================================

Eligibility criteria:
1. Total score on each personality (RIASEC) is at least 9
2. Total score on each ability (10 abilities) is at least 3
3. Total score on each intelligence (8 intelligences) is at least 3

Disqualification criteria:
1. More than 3 personality traits scoring 1 (very low scores)

This check runs after data normalization to filter eligible students.
"""

import pandas as pd
import sys
from typing import Dict, List, Tuple

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'=' * 70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.HEADER}{text.center(70)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.HEADER}{'=' * 70}{Colors.END}\n")

def check_eligibility(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Check eligibility criteria for each student.
    
    Returns:
        eligible_df: DataFrame with eligible students
        ineligible_df: DataFrame with ineligible students
        validation_report: DataFrame with detailed validation results
    """
    print_header("ELIGIBILITY CHECK FOR REPORT GENERATION")
    
    print(f"📊 Checking {len(df)} students for eligibility...\n")
    
    # Personality traits (RIASEC)
    personality_traits = ['Realistic', 'Investigative', 'Artistic', 'Social', 'Enterprising', 'Conventional']
    
    # Ability traits (10 abilities)
    ability_traits = [
        'Creativity',
        'Logical reasoning',
        'Communication',
        'Form perception',
        'Computational',
        'Finger dexterity',
        'Technical',
        'Motor movement',
        'Decision making & problem solving',
        'Speed and accuracy'
    ]
    
    # Intelligence traits (8 intelligences)
    # Handle column name variations
    intelligence_traits = []
    intelligence_mapping = {
        'Bodily-Kinesthetic': ['Bodily-Kinesthetic', 'Bodily Kinesthetic'],
        'Intrapersonal': ['Intrapersonal'],
        'Interpersonal': ['Interpersonal'],
        'Linguistic': ['Linguistic'],
        'Logical-Mathematical': ['Logical-Mathematical', 'Logical Mathematical', 'Logical'],
        'Musical': ['Musical'],
        'Visual-Spatial': ['Visual-Spatial', 'Spatial-Visual', 'Visual Spatial', 'Spatial Visual'],
        'Naturalistic': ['Naturalistic']  # Optional - might be missing
    }
    
    # Build list of actual column names found
    intelligence_column_map = {}  # Maps expected name to actual column name
    for expected_name, possible_names in intelligence_mapping.items():
        for possible in possible_names:
            if possible in df.columns:
                intelligence_column_map[expected_name] = possible
                break
        # If not found, add expected name anyway (will check for missing later)
        if expected_name not in intelligence_column_map:
            intelligence_column_map[expected_name] = expected_name
    
    # Initialize results
    validation_results = []
    eligible_indices = []
    ineligible_indices = []
    
    for idx, row in df.iterrows():
        student_name = row.get('Name', f'Student_{idx}')
        issues = []
        disqualifying_issues = []
        
        # ========================================================================
        # CHECK 1: Personality traits - Each must be ≥ 9
        # ========================================================================
        personality_scores = {}
        personality_low_count = 0  # Count traits scoring 1
        
        for trait in personality_traits:
            if trait in row.index:
                score = pd.to_numeric(row[trait], errors='coerce')
                if pd.isna(score):
                    score = 0
                personality_scores[trait] = score
                
                if score < 9:
                    issues.append(f"Personality {trait}: {score} (< 9)")
                
                # Check for disqualification: trait scoring 1
                if score == 1:
                    personality_low_count += 1
            else:
                personality_scores[trait] = 0
                issues.append(f"Personality {trait}: MISSING")
        
        # Disqualification: More than 3 personality traits scoring 1
        if personality_low_count > 3:
            disqualifying_issues.append(
                f"More than 3 personality traits scoring 1 ({personality_low_count} traits)"
            )
        
        # ========================================================================
        # CHECK 2: Ability traits - Each must be ≥ 3
        # ========================================================================
        ability_scores = {}
        
        for ability in ability_traits:
            if ability in row.index:
                score = pd.to_numeric(row[ability], errors='coerce')
                if pd.isna(score):
                    score = 0
                ability_scores[ability] = score
                
                if score < 3:
                    issues.append(f"Ability {ability}: {score} (< 3)")
            else:
                ability_scores[ability] = 0
                issues.append(f"Ability {ability}: MISSING")
        
        # ========================================================================
        # CHECK 3: Intelligence traits - Each must be ≥ 3
        # ========================================================================
        intelligence_scores = {}
        
        for expected_name, actual_col in intelligence_column_map.items():
            if actual_col in row.index:
                score = pd.to_numeric(row[actual_col], errors='coerce')
                if pd.isna(score):
                    score = 0
                intelligence_scores[expected_name] = score
                
                # Only check minimum if column exists (Naturalistic might be missing)
                if score < 3:
                    issues.append(f"Intelligence {expected_name}: {score} (< 3)")
            else:
                # Missing column: Naturalistic is optional, others are required
                if expected_name != 'Naturalistic':  # Non-Naturalistic intelligences are required
                    intelligence_scores[expected_name] = 0
                    issues.append(f"Intelligence {expected_name}: MISSING")
                else:
                    # Missing Naturalistic is OK - don't add to issues
                    intelligence_scores[expected_name] = 0
        
        # ========================================================================
        # DETERMINE ELIGIBILITY
        # ========================================================================
        is_disqualified = len(disqualifying_issues) > 0
        has_eligibility_issues = len(issues) > 0
        is_eligible = not is_disqualified and not has_eligibility_issues
        
        validation_results.append({
            'Name': student_name,
            'Class': row.get('Class', ''),
            'Eligible': 'Yes' if is_eligible else 'No',
            'Disqualified': 'Yes' if is_disqualified else 'No',
            'Issues_Count': len(issues),
            'Disqualifying_Issues': '; '.join(disqualifying_issues) if disqualifying_issues else '',
            'Issues': '; '.join(issues) if issues else 'None',
            'Personality_Low_Count': personality_low_count,
        })
        
        if is_eligible:
            eligible_indices.append(idx)
        else:
            ineligible_indices.append(idx)
    
    # Create results DataFrames
    validation_report = pd.DataFrame(validation_results)
    eligible_df = df.loc[eligible_indices].copy() if eligible_indices else pd.DataFrame()
    ineligible_df = df.loc[ineligible_indices].copy() if ineligible_indices else pd.DataFrame()
    
    # ========================================================================
    # PRINT SUMMARY
    # ========================================================================
    print(f"{Colors.BLUE}Eligibility Summary:{Colors.END}")
    print(f"  ✅ Eligible students: {len(eligible_df)}")
    print(f"  ❌ Ineligible students: {len(ineligible_df)}")
    print()
    
    if len(ineligible_df) > 0:
        print(f"{Colors.YELLOW}⚠️  INELIGIBLE STUDENTS:{Colors.END}")
        for idx in ineligible_indices:
            result = validation_results[df.index.get_loc(idx)]
            print(f"\n  {Colors.RED}❌ {result['Name']} (Class {result['Class']}){Colors.END}")
            if result['Disqualified'] == 'Yes':
                print(f"     {Colors.RED}DISQUALIFIED: {result['Disqualifying_Issues']}{Colors.END}")
            if result['Issues'] != 'None':
                print(f"     Issues: {result['Issues']}")
    
    print()
    
    # Save validation report
    validation_report_file = 'eligibility_validation_report.xlsx'
    with pd.ExcelWriter(validation_report_file, engine='openpyxl') as writer:
        validation_report.to_excel(writer, sheet_name='Validation_Report', index=False)
    print(f"{Colors.GREEN}✅ Validation report saved: {validation_report_file}{Colors.END}")
    
    return eligible_df, ineligible_df, validation_report

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Check eligibility for report generation')
    parser.add_argument('input_file', help='Input Excel file (normalized)')
    parser.add_argument('--output-eligible', '-e', default='input.xlsx', 
                       help='Output file for eligible students (default: input.xlsx)')
    parser.add_argument('--output-ineligible', '-i', default='ineligible_students.xlsx',
                       help='Output file for ineligible students (default: ineligible_students.xlsx)')
    
    args = parser.parse_args()
    
    # Load normalized data
    df = pd.read_excel(args.input_file, sheet_name='suitability_index')
    
    # Check eligibility
    eligible_df, ineligible_df, validation_report = check_eligibility(df)
    
    # Save eligible students (this will be used by the pipeline)
    if not eligible_df.empty:
        with pd.ExcelWriter(args.output_eligible, engine='openpyxl') as writer:
            eligible_df.to_excel(writer, sheet_name='suitability_index', index=False)
        print(f"{Colors.GREEN}✅ Eligible students saved to: {args.output_eligible}{Colors.END}")
    else:
        print(f"{Colors.RED}❌ No eligible students found!{Colors.END}")
        sys.exit(1)
    
    # Save ineligible students (for review)
    if not ineligible_df.empty:
        with pd.ExcelWriter(args.output_ineligible, engine='openpyxl') as writer:
            ineligible_df.to_excel(writer, sheet_name='ineligible', index=False)
        print(f"{Colors.YELLOW}⚠️  Ineligible students saved to: {args.output_ineligible}{Colors.END}")
    
    print(f"\n{Colors.GREEN}{'=' * 70}{Colors.END}")
    print(f"{Colors.GREEN}✅ ELIGIBILITY CHECK COMPLETE{Colors.END}")
    print(f"{Colors.GREEN}{'=' * 70}{Colors.END}\n")