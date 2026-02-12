"""
PHASE 0: DATA NORMALIZATION
==========================
Normalizes different input Excel formats to a standard format for the pipeline.
Handles:
- OMR data (RIASEC codes, trailing spaces, different column names)
- Online assessment data (full names, standard column names)
- Variations and typos in column names
"""

import pandas as pd
import os
import sys
from typing import Dict, List, Optional

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

def find_column(df: pd.DataFrame, possible_names: List[str], description: str = "") -> Optional[str]:
    """Find a column by trying multiple possible names (case-insensitive, space-tolerant)."""
    df_cols_lower = {col.strip().lower(): col for col in df.columns}
    
    for name in possible_names:
        name_lower = name.strip().lower()
        # Exact match first (highest priority)
        if name_lower in df_cols_lower:
            return df_cols_lower[name_lower]
        
        # Word-based matching (check if all significant words are present)
        name_words = set(name_lower.split())
        for col_key, col_orig in df_cols_lower.items():
            # Skip single-letter columns (likely RIASEC codes) for multi-word searches
            if len(name_words) > 1 and len(col_key) <= 1:
                continue
            
            col_words = set(col_key.split())
            # If most significant words match (at least 50% overlap)
            if len(name_words) > 0:
                overlap = len(name_words & col_words) / len(name_words)
                if overlap >= 0.5 and len(name_words & col_words) > 0:
                    return col_orig
    
    return None

def normalize_excel(input_file: str, output_file: str = "input.xlsx") -> pd.DataFrame:
    """
    Normalize input Excel file to standard format.
    
    Returns:
        Normalized DataFrame ready for pipeline processing
    """
    print_header("PHASE 0: DATA NORMALIZATION")
    
    if not os.path.exists(input_file):
        print(f"{Colors.RED}❌ Error: Input file not found: {input_file}{Colors.END}")
        sys.exit(1)
    
    print(f"📁 Loading: {input_file}")
    
    # Try to find the data sheet (common names)
    sheet_candidates = ['Sheet1', 'suitability_index', 'Student Data', 'Data', 'Sheet']
    df = None
    sheet_name = None
    
    xl_file = pd.ExcelFile(input_file)
    available_sheets = xl_file.sheet_names
    print(f"📋 Available sheets: {available_sheets}")
    
    # Find the first available sheet or use first sheet
    for candidate in sheet_candidates:
        for sheet in available_sheets:
            if candidate.lower() in sheet.lower():
                sheet_name = sheet
                break
        if sheet_name:
            break
    
    if not sheet_name:
        sheet_name = available_sheets[0]
    
    print(f"📊 Using sheet: {sheet_name}")
    df = pd.read_excel(input_file, sheet_name=sheet_name)
    
    print(f"✅ Loaded {len(df)} rows, {len(df.columns)} columns")
    
    # ============================================================================
    # STEP 1: NORMALIZE COLUMN NAMES (Strip spaces, standardize)
    # ============================================================================
    print(f"\n{Colors.BLUE}Step 1: Normalizing column names...{Colors.END}")
    
    # Create mapping of original -> normalized column names
    column_mapping = {}
    
    for col in df.columns:
        normalized = col.strip()
        column_mapping[col] = normalized
    
    df.rename(columns=column_mapping, inplace=True)
    print(f"  ✅ Stripped trailing/leading spaces from {len(column_mapping)} columns")
    
    # ============================================================================
    # STEP 2: MAP INTELLIGENCE COLUMNS (Handle variations)
    # ============================================================================
    print(f"\n{Colors.BLUE}Step 2: Standardizing intelligence columns...{Colors.END}")
    
    intelligence_mapping = {
        'Bodily-Kinesthetic': ['bodily-kinesthetic', 'bodily kinesthetic', 'kinesthetic'],
        'Intrapersonal': ['intrapersonal'],
        'Interpersonal': ['interpersonal'],
        'Linguistic': ['linguistic'],
        'Logical-Mathematical': ['logical-mathematical', 'logical mathematical', 'logical'],
        'Musical': ['musical'],
        'Visual-Spatial': ['spatial-visual', 'spatial visual', 'visual-spatial', 'visual spatial'],  # Prioritize spatial-visual first
        'Naturalistic': ['naturalistic', 'natural']
    }
    
    intelligence_renames = {}
    found_intel = []
    missing_intel = []
    
    for expected_name, possible_names in intelligence_mapping.items():
        found_col = find_column(df, possible_names, f"intelligence ({expected_name})")
        if found_col:
            if found_col != expected_name:
                intelligence_renames[found_col] = expected_name
            found_intel.append(expected_name)
            print(f"  ✅ {expected_name:25s} → \"{found_col}\"")
        else:
            missing_intel.append(expected_name)
            print(f"  {Colors.YELLOW}⚠️  {expected_name:25s} → MISSING (will add empty column){Colors.END}")
            df[expected_name] = 0  # Add missing column with default value
    
    df.rename(columns=intelligence_renames, inplace=True)
    
    if missing_intel:
        print(f"  {Colors.YELLOW}⚠️  Added {len(missing_intel)} missing intelligence columns with default value 0{Colors.END}")
    
    # ============================================================================
    # STEP 3: MAP PERSONALITY COLUMNS (RIASEC codes → Full names)
    # ============================================================================
    print(f"\n{Colors.BLUE}Step 3: Standardizing personality columns...{Colors.END}")
    
    riasec_mapping = {
        'R': 'Realistic',
        'I': 'Investigative',
        'A': 'Artistic',
        'S': 'Social',
        'E': 'Enterprising',
        'C': 'Conventional'
    }
    
    personality_renames = {}
    found_personality = []
    missing_personality = []
    
    for code, full_name in riasec_mapping.items():
        # Check for RIASEC code columns
        if code in df.columns:
            personality_renames[code] = full_name
            found_personality.append(full_name)
            print(f"  ✅ {full_name:15s} → Column \"{code}\" (RIASEC code)")
        # Check for full name columns (might already be normalized)
        elif full_name in df.columns:
            found_personality.append(full_name)
            print(f"  ✅ {full_name:15s} → Column \"{full_name}\" (already normalized)")
        else:
            missing_personality.append(full_name)
            print(f"  {Colors.YELLOW}⚠️  {full_name:15s} → MISSING (will add empty column){Colors.END}")
            df[full_name] = 0
    
    df.rename(columns=personality_renames, inplace=True)
    
    if missing_personality:
        print(f"  {Colors.YELLOW}⚠️  Added {len(missing_personality)} missing personality columns with default value 0{Colors.END}")
    
    # ============================================================================
    # STEP 4: MAP ABILITY COLUMNS (Handle variations)
    # ============================================================================
    print(f"\n{Colors.BLUE}Step 4: Standardizing ability columns...{Colors.END}")
    
    ability_mapping = {
        'Creativity': ['creativity /artistic', 'creativity/artistic', 'creativity', 'artistic'],
        'Logical reasoning': ['logical reasoning'],
        'Communication': ['language/ communication', 'language/communication', 'language communication', 'communication'],
        'Form perception': ['form perception'],
        'Computational': ['computational'],
        'Finger dexterity': ['finger dexterity'],
        'Technical': ['technical'],
        'Motor movement': ['motor movement'],
        'Decision making & problem solving': ['decision making & problem solving', 'decision making and problem solving'],
        'Speed and accuracy': ['speed and accuracy']
    }
    
    ability_renames = {}
    found_abilities = []
    missing_abilities = []
    
    for expected_name, possible_names in ability_mapping.items():
        found_col = find_column(df, possible_names, f"ability ({expected_name})")
        if found_col:
            if found_col != expected_name:
                ability_renames[found_col] = expected_name
            found_abilities.append(expected_name)
            print(f"  ✅ {expected_name:35s} → \"{found_col[:45]}\"")
        else:
            missing_abilities.append(expected_name)
            print(f"  {Colors.YELLOW}⚠️  {expected_name:35s} → MISSING (will add empty column){Colors.END}")
            df[expected_name] = 0
    
    df.rename(columns=ability_renames, inplace=True)
    
    if missing_abilities:
        print(f"  {Colors.YELLOW}⚠️  Added {len(missing_abilities)} missing ability columns with default value 0{Colors.END}")
    
    # ============================================================================
    # STEP 5: STANDARDIZE SOI / CAREER ASPIRATIONS / VALUES (NAMES + CONTENT)
    # ============================================================================
    print(f"\n{Colors.BLUE}Step 5: Standardizing SOI/Career Aspirations/Values...{Colors.END}")

    # 5.a SOI columns
    soi_renames = {}
    soi_variants = [
        "SOI {i}",
        "Subject Of Interest {i}",
        "Subjects Of Interest {i}",
        "Subject of Interest {i}",
        "Subjects of Interest {i}"
    ]
    for i in range(1, 6):
        expected_col = f"Subject Of Interest {i}"
        # Find any variant present
        found = None
        for variant in soi_variants:
            name = variant.format(i=i)
            if name in df.columns:
                found = name
                break
        if found:
            if found != expected_col:
                soi_renames[found] = expected_col
                print(f"  ✅ {expected_col:25s} ← \"{found}\"")
            else:
                print(f"  ✅ {expected_col:25s} → Already normalized")
        else:
            print(f"  {Colors.YELLOW}⚠️  {expected_col:25s} → MISSING{Colors.END}")
            df[expected_col] = ""
    df.rename(columns=soi_renames, inplace=True)

    # Clean SOI cell text
    for i in range(1, 5+1):
        col = f"Subject Of Interest {i}"
        if col in df.columns:
            df[col] = df[col].apply(lambda x: str(x).strip().replace("  ", " ") if pd.notna(x) else "")

    # 5.b Career Aspirations
    ca_renames = {}
    ca_variants = [
        "Career Aspiration {i}",
        "Career aspiration {i}",
        "Career  Aspiration {i}",
        "Aspiration {i}"
    ]
    for i in range(1, 4+1):
        expected_col = f"Career Aspiration {i}"
        found = None
        for variant in ca_variants:
            name = variant.format(i=i)
            if name in df.columns:
                found = name
                break
        if found:
            if found != expected_col:
                ca_renames[found] = expected_col
                print(f"  ✅ {expected_col:25s} ← \"{found}\"")
            else:
                print(f"  ✅ {expected_col:25s} → Already normalized")
        else:
            print(f"  {Colors.YELLOW}⚠️  {expected_col:25s} → MISSING{Colors.END}")
            df[expected_col] = ""
    df.rename(columns=ca_renames, inplace=True)

    # Clean Career Aspiration cell text
    for i in range(1, 4+1):
        col = f"Career Aspiration {i}"
        if col in df.columns:
            df[col] = df[col].apply(lambda x: str(x).strip().replace("  ", " ") if pd.notna(x) else "")

    # 5.c Values
    values_renames = {}
    values_variants = [
        "Value {i}",
        "Values {i}",
        "Core Value {i}",
        "Core Values {i}"
    ]
    for i in range(1, 5+1):
        expected_col = f"Value {i}"
        found = None
        for variant in values_variants:
            name = variant.format(i=i)
            if name in df.columns:
                found = name
                break
        if found:
            if found != expected_col:
                values_renames[found] = expected_col
                print(f"  ✅ {expected_col:25s} ← \"{found}\"")
            else:
                print(f"  ✅ {expected_col:25s} → Already normalized")
        else:
            print(f"  {Colors.YELLOW}⚠️  {expected_col:25s} → MISSING{Colors.END}")
            df[expected_col] = ""
    df.rename(columns=values_renames, inplace=True)

    # Clean Values cell text (capitalize first letters for consistency later)
    for i in range(1, 5+1):
        col = f"Value {i}"
        if col in df.columns:
            df[col] = df[col].apply(lambda x: str(x).strip().replace("  ", " ") if pd.notna(x) else "")
    
    # ============================================================================
    # STEP 6: VALIDATE REQUIRED COLUMNS
    # ============================================================================
    print(f"\n{Colors.BLUE}Step 6: Validating required columns...{Colors.END}")
    
    required_columns = {
        'Name': ['name'],
        'Class': ['class'],
    }
    
    for expected_name, possible_names in required_columns.items():
        found_col = find_column(df, possible_names, expected_name)
        if found_col:
            if found_col != expected_name:
                df.rename(columns={found_col: expected_name}, inplace=True)
            print(f"  ✅ {expected_name}")
        else:
            print(f"  {Colors.RED}❌ {expected_name} → MISSING (CRITICAL){Colors.END}")
            sys.exit(1)
    
    # ============================================================================
    # STEP 7: SAVE NORMALIZED DATA
    # ============================================================================
    print(f"\n{Colors.BLUE}Step 7: Saving normalized data...{Colors.END}")
    
    # Ensure output directory exists
    output_dir = os.path.dirname(output_file) if os.path.dirname(output_file) else '.'
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Save to Excel with 'suitability_index' sheet name (expected by pipeline)
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='suitability_index', index=False)
    
    print(f"  ✅ Saved normalized data: {output_file}")
    print(f"  ✅ Sheet name: 'suitability_index'")
    print(f"  ✅ Total rows: {len(df)}")
    print(f"  ✅ Total columns: {len(df.columns)}")
    
    # ============================================================================
    # SUMMARY
    # ============================================================================
    print(f"\n{Colors.GREEN}{'=' * 70}{Colors.END}")
    print(f"{Colors.GREEN}✅ NORMALIZATION COMPLETE{Colors.END}")
    print(f"{Colors.GREEN}{'=' * 70}{Colors.END}")
    print(f"\n📊 Summary:")
    print(f"   • Intelligence traits: {len(found_intel)}/8 found")
    print(f"   • Personality traits: {len(found_personality)}/6 found")
    print(f"   • Ability traits: {len(found_abilities)}/10 found")
    
    if missing_intel or missing_personality or missing_abilities:
        print(f"\n{Colors.YELLOW}⚠️  Missing columns were added with default values{Colors.END}")
    
    return df

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Normalize input Excel file to standard format')
    parser.add_argument('input_file', help='Input Excel file path')
    parser.add_argument('--output', '-o', default='input.xlsx', help='Output file (default: input.xlsx)')
    
    args = parser.parse_args()
    
    normalize_excel(args.input_file, args.output)
    
    print(f"\n{Colors.GREEN}✅ Data normalized and ready for pipeline!{Colors.END}\n")