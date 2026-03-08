#!/usr/bin/env python3
"""
Phase 3: Career Matching
Compares student's career aspirations with recommended pathways
Input: suitability_index sheet with career aspirations
Output: Career_Match_Result column added
"""

import pandas as pd
from datetime import datetime

print("=" * 70)
print("PHASE 3: CAREER MATCHING")
print("=" * 70)
print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()

# ============================================================================
# LOAD DATA
# ============================================================================
print("Loading data...")

INPUT_FILE = "input.xlsx"
df = pd.read_excel(INPUT_FILE, sheet_name='suitability_index')

print(f"  ✅ Loaded {len(df)} students")

# ============================================================================
# MATCH CAREER ASPIRATIONS WITH RECOMMENDATIONS
# ============================================================================
print("\nMatching career aspirations...")

for idx, row in df.iterrows():
    name = row['Name']
    
    # Get student's career aspirations (1-4)
    aspirations = []
    for i in range(1, 5):
        asp = row.get(f'Career Aspiration {i}', '')
        if asp and str(asp).strip() and str(asp).lower() != 'nan':
            aspirations.append(str(asp).strip().lower())
    
    # Get top 3 recommended pathways
    recommendations = []
    for i in range(1, 4):
        rec = row.get(f'suitability_index_{i}', '')
        if rec and str(rec).strip() and str(rec).lower() != 'nan':
            recommendations.append(str(rec).strip().lower())
    
    # Create comprehensive mapping for naming differences
    aspiration_mapping = {
        'information technology and allied fields': 'computer science, it and allied fields',
        'art, design': 'art design',
        'banking & finance': 'banking and finance',
        'defense/ protective service': 'defence/ protective service',
        'social science/ humanities': 'social sciences and humanities',
        'life sciences /medicine and healthcare': 'life sciences /medicine and healthcare',
        'management and administration': 'management and administration',
        'entertainment and mass media': 'entertainment and mass media'
    }
    
    # Normalize aspirations using mapping
    normalized_aspirations = []
    original_to_normalized = {}
    for asp in aspirations:
        normalized_asp = aspiration_mapping.get(asp, asp)
        normalized_aspirations.append(normalized_asp)
        original_to_normalized[asp] = normalized_asp
    
    # Check for matches
    matches = []
    matched_aspirations = []
    
    for i, asp in enumerate(aspirations):
        normalized_asp = aspiration_mapping.get(asp, asp)
        found_match = False
        
        for rec in recommendations:
            # Exact match
            if normalized_asp == rec:
                matches.append((asp, rec))
                matched_aspirations.append(asp)
                found_match = True
                break
            # Partial matching for complex names
            elif (normalized_asp in rec or rec in normalized_asp) and len(normalized_asp) > 3 and len(rec) > 3:
                matches.append((asp, rec))
                matched_aspirations.append(asp)
                found_match = True
                break
    
    # Generate result message with specific matched careers
    if matches:
        if len(matched_aspirations) == 1:
            result = f"Congratulations! Your career aspiration in {matched_aspirations[0]} aligns perfectly with our recommendations. This shows that your interests and natural abilities are well-matched."
        elif len(matched_aspirations) == 2:
            result = f"Excellent news! Your career aspirations in {matched_aspirations[0]} and {matched_aspirations[1]} align with our recommendations. This indicates strong alignment between your interests and natural abilities."
        else:
            aspirations_text = ", ".join(matched_aspirations[:-1]) + f" and {matched_aspirations[-1]}"
            result = f"Outstanding! Your career aspirations in {aspirations_text} align with our recommendations. This shows excellent alignment between your interests and natural abilities."
    else:
        result = "We notice that your current career aspirations don't directly align with our assessment results. However, this is completely normal and doesn't diminish your potential. The assessment identifies your natural strengths, which can be valuable in many career paths, including the ones you're interested in. Consider exploring how your strengths could enhance your chosen fields."
    
    df.at[idx, 'Career_Match_Result'] = result
    
    print(f"  {name}: {'✅ Match' if matches else '❌ No match'} ({len(matches)}/{len(aspirations)} aspirations matched)")

# ============================================================================
# SAVE RESULTS
# ============================================================================
print("\n" + "=" * 70)
print("Saving results...")

with pd.ExcelWriter(INPUT_FILE, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
    df.to_excel(writer, sheet_name='suitability_index', index=False)

print(f"✅ Phase 3 Complete!")
print(f"   Added Career_Match_Result column")
print(f"   Students processed: {len(df)}")
print(f"   Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 70)