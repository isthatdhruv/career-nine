#!/usr/bin/env python3
"""
Phase 1: Core Analysis
Combines: top_personality, top_intelligence, preference, ability, suitability, weak_ability
Input: Raw Excel with test scores
Output: input.xlsx with analysis sheets
"""

import pandas as pd
import numpy as np
import os
from datetime import datetime

print("=" * 70)
print("PHASE 1: CORE ANALYSIS")
print("=" * 70)
print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()

# ============================================================================
# STEP 1: TOP PERSONALITY (ORIGINAL COMPLEX LOGIC)
# ============================================================================
print("Step 1/6: Calculating Personality Stanine Scores...")

INPUT_FILE = "input.xlsx"
df = pd.read_excel(INPUT_FILE)

# Original stanine mappings for each personality trait
stanine_mapping = {
    "Realistic": {
        1: [9, 10, 11, 12],
        2: [13, 14],
        3: [15],
        4: [16],
        5: [17],
        6: [18],
        7: [19.5],
        8: [19],
        9: [20]
    },
    "Investigative": {
        1: [9, 10, 11, 12, 13],
        2: [14],
        3: [15],
        4: [16],
        5: [17],
        6: [18],
        7: [19.5],
        8: [19],
        9: [20]
    },
    "Artistic": {
        1: [9, 10, 11, 12, 13],
        2: [14],
        3: [15, 16],
        4: [17],
        5: [17.5],
        6: [18],
        7: [19.5],
        8: [19],
        9: [20]
    },
    "Social": {
        1: [9, 10, 11, 12, 13],
        2: [14, 15],
        3: [16],
        4: [17],
        5: [17.5],
        6: [18],
        7: [19.5],
        8: [19],
        9: [20]
    },
    "Enterprising": {
        1: [9, 10, 11, 12, 13],
        2: [14],
        3: [15, 16],
        4: [17],
        5: [17.5],
        6: [18],
        7: [19.5],
        8: [19],
        9: [20]
    },
    "Conventional": {
        1: [9, 10, 11, 12],
        2: [13],
        3: [14, 15, 16],
        4: [17],
        5: [17.5],
        6: [18],
        7: [19.5],
        8: [19],
        9: [20]
    }
}

# RIASEC code mapping for backward compatibility
riasec_mapping = {
    "R": "Realistic",
    "I": "Investigative", 
    "A": "Artistic",
    "S": "Social",
    "E": "Enterprising",
    "C": "Conventional"
}

def get_personality_traits(df):
    """Get personality traits from dataframe, supporting both full names and RIASEC codes."""
    traits = ["Realistic", "Investigative", "Artistic", "Social", "Enterprising", "Conventional"]
    available_traits = []
    
    # First check for full names
    for trait in traits:
        if trait in df.columns:
            available_traits.append(trait)
    
    # If no full names found, check for RIASEC codes
    if not available_traits:
        for code, trait in riasec_mapping.items():
            if code in df.columns:
                available_traits.append(trait)
    
    # If still no traits found, check for columns with trailing spaces
    if not available_traits:
        for trait in traits:
            for col in df.columns:
                if col.strip() == trait:
                    available_traits.append(trait)
                    break
    
    # If still no full names, check RIASEC codes with spaces
    if not available_traits:
        for code, trait in riasec_mapping.items():
            for col in df.columns:
                if col.strip() == code:
                    available_traits.append(trait)
                    break
    
    return available_traits

def get_stanine(trait, raw_score):
    """Convert a raw score to its corresponding stanine."""
    try:
        score = float(raw_score)
    except (ValueError, TypeError):
        return None
    mapping = stanine_mapping.get(trait, {})
    for stanine, possible_scores in mapping.items():
        if any(abs(score - float(val)) < 1e-6 for val in possible_scores):
            return stanine
    return None

def get_intelligence_score(trait, row):
    """Map a personality trait to its corresponding intelligence score."""
    if trait == "Realistic":
        return row.get("Bodily-Kinesthetic", 0)
    elif trait == "Investigative":
        return row.get("Logical", 0)
    elif trait == "Artistic":
        musical = row.get("Musical", 0)
        spatial = row.get("Visual-Spatial", 0)
        return (musical + spatial) / 2
    elif trait in ["Social", "Enterprising"]:
        return row.get("Interpersonal", 0)
    elif trait == "Conventional":
        return row.get("Intrapersonal", 0)
    else:
        return 0

def get_ability_score(trait, row):
    """Map a personality trait to its corresponding ability score."""
    if trait == "Realistic":
        fd = row.get("Finger dexterity", 0)
        mm = row.get("Motor movement", 0)
        return (fd + mm) / 2
    elif trait == "Investigative":
        comp = row.get("Computational", 0)
        tech = row.get("Technical", 0)
        lr = row.get("Logical reasoning", 0)
        return (comp + tech + lr) / 3
    elif trait == "Artistic":
        fp = row.get("Form perception", 0)
        creat = row.get("Creativity", 0)
        return (fp + creat) / 2
    elif trait == "Social":
        return row.get("Communication", 0)
    elif trait == "Enterprising":
        lang = row.get("Communication", 0)
        dps = row.get("Decision making & problem solving", 0)
        return (lang + dps) / 2
    elif trait == "Conventional":
        return row.get("Speed and accuracy", 0)
    else:
        return 0

def resolve_ambiguous_group(traits_list, row, slots_needed):
    """Resolve ties using intelligence scores, then ability scores."""
    log_entries = []
    # Step 1: Resolve by Intelligence Scores
    intel_scores = {t: get_intelligence_score(t, row) for t in traits_list}
    log_entries.append("Intelligence scores: " + ", ".join(f"{t}={intel_scores[t]}" for t in traits_list))
    sorted_by_intel = sorted(traits_list, key=lambda t: intel_scores[t], reverse=True)
    
    # Group traits by their intelligence score
    intel_groups = {}
    for t in sorted_by_intel:
        score = intel_scores[t]
        intel_groups.setdefault(score, []).append(t)
    sorted_intel_groups = sorted(intel_groups.items(), key=lambda x: x[0], reverse=True)
    
    result = []
    for score, group in sorted_intel_groups:
        if len(result) < slots_needed:
            if len(result) + len(group) < slots_needed:
                result.extend(group)
            elif len(result) + len(group) == slots_needed:
                result.extend(group)
            else:
                # We have a boundary group that exceeds what we need.
                needed = slots_needed - len(result)
                log_entries.append(f"Boundary intelligence group (score {score}) has {len(group)} traits; need {needed}.")
                # Step 2: Resolve by Ability Scores within this group
                ability_scores = {t: get_ability_score(t, row) for t in group}
                log_entries.append("Ability scores for boundary group: " + ", ".join(f"{t}={ability_scores[t]}" for t in group))
                sorted_by_ability = sorted(group, key=lambda t: ability_scores[t], reverse=True)
                # Check if the needed-th trait ties with others:
                if needed < len(sorted_by_ability):
                    boundary_ability = ability_scores[sorted_by_ability[needed-1]]
                    tied_in_boundary = [t for t in sorted_by_ability if abs(get_ability_score(t, row) - boundary_ability) < 1e-6]
                    if len(tied_in_boundary) > needed:
                        log_entries.append("Ambiguity unresolved at ability level; selecting top " + str(needed))
                        result.extend(sorted_by_ability[:needed])
                    else:
                        result.extend(sorted_by_ability[:needed])
                else:
                    result.extend(sorted_by_ability[:needed])
                break  # We have filled our slots.
    return result, " ; ".join(log_entries)

def get_top3_traits(row, available_traits):
    """Determine top 3 personality traits with tie-breaking."""
    traits = ["Realistic", "Investigative", "Artistic", "Social", "Enterprising", "Conventional"]
    traits_to_use = available_traits if available_traits else traits
    
    # Build list of (trait, stanine) tuples.
    trait_scores = []
    for trait in traits_to_use:
        stanine = row.get(f"Stanine_{trait}")
        if stanine is None:
            stanine = float('-inf')
        trait_scores.append((trait, stanine))
    
    # Sort by stanine descending (and alphabetically if tied).
    sorted_traits = sorted(trait_scores, key=lambda x: (x[1], x[0]), reverse=True)
    
    # Group by stanine score.
    groups = {}
    for trait, score in sorted_traits:
        groups.setdefault(score, []).append(trait)
    sorted_groups = sorted(groups.items(), key=lambda x: x[0], reverse=True)
    
    log_lines = []
    log_lines.append("Descending stanine sequence with trait counts:")
    for score, group in sorted_groups:
        log_lines.append(f"  Score {score}: {len(group)} trait(s) ({', '.join(group)})")
    
    top_traits = []
    position_details = []
    
    # Process each stanine group (from highest to lowest)
    for score, group in sorted_groups:
        if len(top_traits) >= 3:
            break
        slots_needed = 3 - len(top_traits)
        if len(group) <= slots_needed:
            top_traits.extend(group)
            for t in group:
                position_details.append(f"Rank {len(top_traits)-slots_needed+group.index(t)+1}: {t} (unique from score {score})")
        else:
            # Too many traits in this group—apply tie-breaker.
            resolved, tie_log = resolve_ambiguous_group(group, row, slots_needed)
            top_traits.extend(resolved)
            for t in resolved:
                position_details.append(f"Rank {len(top_traits)-slots_needed+resolved.index(t)+1}: {t} (resolved from score {score})")
            log_lines.append(f"Tie-breaker details for score {score}: {tie_log}")
    
    # Ensure exactly 3 positions (if not, fill with None)
    while len(top_traits) < 3:
        top_traits.append(None)
        position_details.append(f"Rank {len(top_traits)}: None")
    
    log_lines.extend(position_details)
    if any("tie breaker" in detail.lower() for detail in position_details):
        log_lines.append("Overall: Tie breakers were needed for one or more of the top 3 positions.")
    else:
        log_lines.append("Overall: Top 3 traits are uniquely determined.")
    
    final_log = "\n".join(log_lines)
    
    return pd.Series({
        "Personality_Top1": top_traits[0],
        "Personality_Top2": top_traits[1],
        "Personality_Top3": top_traits[2],
        "Personality_Log": final_log
    })

# Get available personality traits
available_traits = get_personality_traits(df)

# Create column mapping for RIASEC codes if needed
column_mapping = {}
for trait in available_traits:
    if trait in df.columns:
        column_mapping[trait] = trait
    else:
        # Find the RIASEC code for this trait
        for code, full_name in riasec_mapping.items():
            if full_name == trait and code in df.columns:
                column_mapping[trait] = code
                break
            # Check for columns with trailing spaces
            elif full_name == trait:
                for col in df.columns:
                    if col.strip() == code:
                        column_mapping[trait] = col
                        break

# Compute stanine columns for each available personality trait.
for trait in available_traits:
    col_name = column_mapping[trait]
    df[f"Stanine_{trait}"] = df[col_name].apply(lambda x: get_stanine(trait, x))

# Determine the top 3 personality traits (with detailed logging and tie-breakers).
top3_df = df.apply(lambda row: get_top3_traits(row, available_traits), axis=1)

# Drop existing personality columns to avoid duplicates
existing_personality_cols = [col for col in df.columns if col.startswith('Personality_')]
if existing_personality_cols:
    df = df.drop(columns=existing_personality_cols)

# Concatenate the new columns with the original DataFrame.
df = pd.concat([df, top3_df], axis=1)

print(f"  ✅ Calculated stanine scores for {len(available_traits)} traits")
print(f"  ✅ Identified top 3 personalities for {len(df)} students")

# ============================================================================
# STEP 2: TOP INTELLIGENCE (ORIGINAL COMPLEX LOGIC)
# ============================================================================
print("\nStep 2/6: Identifying Top & Bottom Intelligence...")

# Define Intelligence to Personality Mapping
intel_to_personality = {
    "Bodily-Kinesthetic": ["Realistic"],
    "Naturalistic": ["Realistic"],  # Ignored for now.
    "Intrapersonal": ["Conventional"],
    "Interpersonal": ["Social", "Enterprising"],
    "Linguistic": ["Social"],
    "Logical": ["Investigative"],
    "Musical": ["Artistic"],
    "Visual-Spatial": ["Artistic"]
}

# List of intelligence types excluding Naturalistic.
intelligence_types = [
    "Bodily-Kinesthetic", 
    "Intrapersonal",
    "Interpersonal", 
    "Linguistic", 
    "Logical-Mathematical",  # Updated to match actual column name
    "Musical", 
    "Spatial-Visual",  # Updated to match actual column name
    "Naturalistic", # Ignored for now.
]

# Column name mapping for intelligence types
intelligence_column_mapping = {
    "Logical-Mathematical": "Logical",
    "Spatial-Visual": "Visual-Spatial"
}

def get_intelligence_columns(df):
    """Get intelligence column names from dataframe, handling name variations."""
    available_intelligence = []
    
    for intel_type in intelligence_types:
        if intel_type in df.columns:
            # Special handling for Naturalistic column
            if intel_type == "Naturalistic":
                # Check if Naturalistic has any non-zero, non-null values
                naturalistic_values = df[intel_type]
                has_meaningful_data = (
                    naturalistic_values.notna().any() and 
                    (naturalistic_values != 0).any()
                )
                if has_meaningful_data:
                    available_intelligence.append(intel_type)
                    print(f"✅ Naturalistic column included (has meaningful data)")
                else:
                    print(f"⚠️  Naturalistic column excluded (no meaningful data)")
            else:
                available_intelligence.append(intel_type)
        elif intel_type in intelligence_column_mapping:
            mapped_name = intelligence_column_mapping[intel_type]
            if mapped_name in df.columns:
                available_intelligence.append(intel_type)
        else:
            # Check for columns with trailing spaces
            for col in df.columns:
                if col.strip() == intel_type:
                    if intel_type == "Naturalistic":
                        # Special handling for Naturalistic with spaces
                        naturalistic_values = df[col]
                        has_meaningful_data = (
                            naturalistic_values.notna().any() and 
                            (naturalistic_values != 0).any()
                        )
                        if has_meaningful_data:
                            available_intelligence.append(intel_type)
                            print(f"✅ Naturalistic column included (has meaningful data)")
                        else:
                            print(f"⚠️  Naturalistic column excluded (no meaningful data)")
                    else:
                        available_intelligence.append(intel_type)
                    break
            # Check mapped names with trailing spaces
            if intel_type in intelligence_column_mapping:
                mapped_name = intelligence_column_mapping[intel_type]
                for col in df.columns:
                    if col.strip() == mapped_name:
                        available_intelligence.append(intel_type)
                        break
    
    return available_intelligence

def resolve_ambiguous_intelligence(group, row, slots_needed):
    """Resolve ties using elimination rules."""
    tie_log = []
    candidates = group.copy()
    # Apply elimination rule for Social.
    if "Interpersonal" in candidates and "Linguistic" in candidates:
        tie_log.append("Eliminating 'Linguistic' in favor of 'Interpersonal' for Social.")
        candidates = [t for t in candidates if t != "Linguistic"]
    # Apply elimination rule for Artistic.
    if "Visual-Spatial" in candidates and "Musical" in candidates:
        tie_log.append("Eliminating 'Musical' in favor of 'Visual-Spatial' for Artistic.")
        candidates = [t for t in candidates if t != "Musical"]
    # If more candidates remain than needed, sort alphabetically.
    if len(candidates) > slots_needed:
        tie_log.append(f"Ambiguity unresolved; selecting top {slots_needed} alphabetically.")
        candidates = sorted(candidates)[:slots_needed]
    else:
        tie_log.append(f"Selected {len(candidates)} candidate(s) after elimination.")
    return candidates, " ; ".join(tie_log)

def get_top3_intelligence(row, available_intelligence):
    """Determine top 3 intelligence types with tie-breaking."""
    log_entries = []
    
    # Use provided intelligence types or fall back to default
    intel_types_to_use = available_intelligence if available_intelligence else intelligence_types
    
    # Filter out Naturalistic for this student if score <= 3
    intel_types_to_use = list(intel_types_to_use)  # Make a copy
    if "Naturalistic" in intel_types_to_use:
        # Check Naturalistic score for this specific student
        nat_col = None
        for col in row.index:
            if col.strip() == "Naturalistic":
                nat_col = col
                break
        if nat_col:
            try:
                nat_score = float(row[nat_col]) if pd.notnull(row[nat_col]) else 0
                if nat_score <= 3:
                    intel_types_to_use.remove("Naturalistic")
                    log_entries.append(f"Naturalistic excluded for this student (score {nat_score} <= 3)")
            except:
                intel_types_to_use.remove("Naturalistic")
                log_entries.append("Naturalistic excluded for this student (invalid score)")
    
    # Build list of (intelligence_type, raw_score) tuples.
    intel_scores_list = []
    for intel in intel_types_to_use:
        # Handle column name mapping
        col_name = intel
        if intel in intelligence_column_mapping:
            mapped_name = intelligence_column_mapping[intel]
            if mapped_name in row.index:
                col_name = mapped_name
            else:
                # Check for columns with trailing spaces
                for col in row.index:
                    if col.strip() == mapped_name:
                        col_name = col
                        break
        
        # If still not found, check for exact match with spaces
        if col_name not in row.index:
            for col in row.index:
                if col.strip() == intel:
                    col_name = col
                    break
        
        try:
            if col_name in row.index:
                score = float(row[col_name])
            else:
                score = 0
        except (ValueError, TypeError):
            score = 0
        intel_scores_list.append((intel, score))
    
    # Sort by raw score descending, then alphabetically.
    sorted_intel = sorted(intel_scores_list, key=lambda x: (x[1], x[0]), reverse=True)
    
    # Group intelligence types by raw score.
    groups = {}
    for intel, score in sorted_intel:
        groups.setdefault(score, []).append(intel)
    sorted_groups = sorted(groups.items(), key=lambda x: x[0], reverse=True)
    
    log_entries.append("Descending intelligence sequence with counts:")
    for score, group in sorted_groups:
        log_entries.append(f"  Score {score}: {len(group)} type(s) ({', '.join(group)})")
    
    # Get the top personality traits from the row.
    top_personalities = set()
    for col in ["Personality_Top1", "Personality_Top2", "Personality_Top3"]:
        if col in row.index:
            val = row[col]
            if pd.notnull(val):
                top_personalities.add(val)
    log_entries.append("Top personality traits from previous analysis: " + ", ".join(top_personalities))
    
    top_intel = []
    position_details = []
    
    # Iterate over groups in descending order.
    for score, group in sorted_groups:
        if len(top_intel) >= 3:
            break
        slots_needed = 3 - len(top_intel)
        if len(group) <= slots_needed:
            # Group fits exactly: add all candidates regardless of mapping.
            current_count = len(top_intel)
            top_intel.extend(group)
            for i, t in enumerate(group):
                position_details.append(f"Rank {current_count + i + 1}: {t} (selected uniquely from score {score})")
            log_entries.append(f"No tie-breaker needed for group with score {score}.")
        else:
            # Tie situation: group has more candidates than slots available.
            # Use mapping only if at least one candidate in the group maps to a top personality.
            mapped_candidates = [t for t in group if set(intel_to_personality.get(t, [])) & top_personalities]
            if mapped_candidates:
                candidates_to_use = mapped_candidates
                log_entries.append(f"For group with score {score}, using mapped candidates: {', '.join(mapped_candidates)}")
            else:
                candidates_to_use = group
                log_entries.append(f"For group with score {score}, no candidate maps to top personalities; using full group.")
            # Now, if the candidate set is larger than the slots needed, apply tie-breaker elimination.
            if len(candidates_to_use) > slots_needed:
                resolved, tie_log = resolve_ambiguous_intelligence(candidates_to_use, row, slots_needed)
                current_count = len(top_intel)
                top_intel.extend(resolved)
                for i, t in enumerate(resolved):
                    position_details.append(f"Rank {current_count + i + 1}: {t} (resolved via tie-breaker from score {score})")
                log_entries.append(f"Tie-breaker details for group with score {score}: {tie_log}")
            else:
                # Candidate set exactly fills the slots.
                current_count = len(top_intel)
                top_intel.extend(candidates_to_use)
                for i, t in enumerate(candidates_to_use):
                    position_details.append(f"Rank {current_count + i + 1}: {t} (selected uniquely from score {score} using mapping)")
                log_entries.append(f"No tie-breaker needed for group with score {score} after mapping.")
    
    # Ensure exactly 3 slots.
    while len(top_intel) < 3:
        top_intel.append(None)
        position_details.append(f"Rank {len(top_intel)}: None")
    
    log_entries.extend(position_details)
    if any("resolved via tie-breaker" in detail.lower() for detail in position_details):
        log_entries.append("Overall: Tie-breakers were needed for one or more of the top 3 positions.")
    else:
        log_entries.append("Overall: Top 3 intelligence types are uniquely determined.")
    
    final_log = "\n".join(log_entries)
    
    return pd.Series({
        "Intelligence_Top1": top_intel[0],
        "Intelligence_Top2": top_intel[1],
        "Intelligence_Top3": top_intel[2],
        "Intelligence_Log": final_log
    })

# Get available intelligence columns
available_intelligence = get_intelligence_columns(df)

print(f"  Found {len(available_intelligence)} intelligence types in data:")
for intel in available_intelligence:
    print(f"    • {intel}")

# Compute top 3 intelligence types for each respondent.
top_intel_df = df.apply(lambda row: get_top3_intelligence(row, available_intelligence), axis=1)

# Drop existing intelligence columns to avoid duplicates
existing_intelligence_cols = [col for col in df.columns if col.startswith('Intelligence_')]
if existing_intelligence_cols:
    df = df.drop(columns=existing_intelligence_cols)

# Concatenate new columns with existing data.
df = pd.concat([df, top_intel_df], axis=1)

print(f"  ✅ Identified top 3 intelligence types")

# ============================================================================
# STEP 3: PREFERENCES (Learning Styles)
# ============================================================================
print("\nStep 3/6: Processing Learning Preferences...")

# Intelligence to Learning Style mapping
intelligence_to_learning_style = {
    'Bodily-Kinesthetic': 'Body smart',
    'Musical': 'Rhythmic',
    'Intrapersonal': 'Self-aware',
    'Interpersonal': 'Interactive',
    'Naturalistic': 'Nature smart',
    'Linguistic': 'Word smart',
    'Logical-Mathematical': 'Logic smart',  # Fixed: was 'Logical'
    'Visual-Spatial': 'Picture smart',
    'Spatial-Visual': 'Picture smart'  # Handle variant naming
}

# Map top 3 intelligences to learning styles
for i in range(1, 4):
    df[f'Learning_Style_{i}'] = df[f'Intelligence_Top{i}'].map(intelligence_to_learning_style)

# Enjoy studies mapping (from existing data or defaults)
enjoy_studies_mapping = {
    'Body smart': 'Physical activities and hands-on learning',
    'Rhythmic': 'Music, rhythm, and patterns in learning',
    'Self-aware': 'Independent study and self-reflection',
    'Interactive': 'Group discussions and collaborative learning',
    'Nature smart': 'Outdoor learning and nature-based activities',
    'Word smart': 'Reading, writing, and verbal expression',
    'Logic smart': 'Problem-solving and analytical thinking',
    'Picture smart': 'Visual learning and spatial reasoning'
}

for i in range(1, 4):
    df[f'Enjoy_Studies_{i}'] = df[f'Learning_Style_{i}'].map(enjoy_studies_mapping)

print(f"  ✅ Mapped {len(df)} students' learning styles")

# ============================================================================
# STEP 4: ABILITY RANKING (ORIGINAL PREDEFINED ORDER LOGIC)
# ============================================================================
print("\nStep 4/6: Ranking Abilities...")

def ordinal(n):
    """Return ordinal string for an integer n (e.g., 1 -> '1st')."""
    if 10 <= n % 100 <= 20:
        suffix = 'th'
    else:
        suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')
    return f"{n}{suffix}"

def get_top5_abilities(row):
    """For a given row (student), determine top 5 abilities with predefined ranking order."""
    # Define the 10 abilities with their tie-breaker ranking (lower number = higher priority)
    abilities = [
        ("Communication", 1),
        ("Decision making & problem solving", 2),
        ("Speed and accuracy", 3),
        ("Creativity", 4),
        ("Computational", 5),
        ("Logical reasoning", 6),
        ("Form perception", 7),
        ("Technical", 8),
        ("Motor movement", 9),
        ("Finger dexterity", 10)
    ]
    
    # Build a list of tuples: (ability, score, ranking)
    ability_scores = []
    for ability, rank in abilities:
        # Find the actual column name (handle trailing spaces)
        col_name = ability
        if ability not in row.index:
            for col in row.index:
                if col.strip() == ability:
                    col_name = col
                    break
        
        try:
            score = float(row[col_name]) if pd.notnull(row[col_name]) else 0
        except Exception:
            score = 0
        ability_scores.append((ability, score, rank))
    
    # Sort by score descending; if tie, sort by ranking ascending.
    sorted_abilities = sorted(ability_scores, key=lambda x: (-x[1], x[2]))
    
    # Select the top 5 abilities (preserving order)
    top5 = sorted_abilities[:5]
    
    # Prepare the result dictionary
    result = {
        "Ability_Top1": top5[0][0] if len(top5) > 0 else None,
        "Ability_Top2": top5[1][0] if len(top5) > 1 else None,
        "Ability_Top3": top5[2][0] if len(top5) > 2 else None,
        "Ability_Top4": top5[3][0] if len(top5) > 3 else None,
        "Ability_Top5": top5[4][0] if len(top5) > 4 else None,
    }
    return pd.Series(result)

# Apply the get_top5_abilities function to each row.
ability_results = df.apply(get_top5_abilities, axis=1)

# Concatenate the original DataFrame with the new ability columns.
df = pd.concat([df, ability_results], axis=1)

print(f"  ✅ Ranked top 5 abilities for {len(df)} students")

# ============================================================================
# STEP 5: CAREER PATHWAY SUITABILITY (ORIGINAL LOGIC)
# ============================================================================
print("\nStep 5/6: Calculating Career Pathway Suitability...")

# Define the original mapping table (as a list of dicts)
# Each dictionary represents a career pathway with personality codes and ability ranks
mapping_data = [
    {"Pathway": "Architecture", 
     "P1": "A", "P2": "I", "P3": "R", 
     "Ab1": np.nan, "Ab2": 2, "Ab3": 5, "Ab4": 1, "Ab5": 3, "Ab6": np.nan, "Ab7": np.nan, "Ab8": 4, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Art, Design", 
     "P1": "A", "P2": "E", "P3": "S", 
     "Ab1": 2, "Ab2": 5, "Ab3": 3, "Ab4": 1, "Ab5": np.nan, "Ab6": np.nan, "Ab7": np.nan, "Ab8": np.nan, "Ab9": np.nan, "Ab10": 4},
     
    {"Pathway": "Entertainment and Mass Media", 
     "P1": "A", "P2": "S", "P3": "E", 
     "Ab1": 2, "Ab2": np.nan, "Ab3": 3, "Ab4": 1, "Ab5": np.nan, "Ab6": 5, "Ab7": np.nan, "Ab8": 4, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Management and Administration", 
     "P1": "C", "P2": "E", "P3": "S", 
     "Ab1": 4, "Ab2": 3, "Ab3": 2, "Ab4": np.nan, "Ab5": 1, "Ab6": 5, "Ab7": np.nan, "Ab8": np.nan, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Banking and Finance", 
     "P1": "C", "P2": "I", "P3": "E", 
     "Ab1": np.nan, "Ab2": 3, "Ab3": 2, "Ab4": np.nan, "Ab5": 1, "Ab6": 4, "Ab7": np.nan, "Ab8": np.nan, "Ab9": np.nan, "Ab10": 5},
     
    {"Pathway": "Law Studies", 
     "P1": "C", "P2": "I", "P3": "E", 
     "Ab1": 1, "Ab2": 2, "Ab3": 4, "Ab4": 5, "Ab5": np.nan, "Ab6": 3, "Ab7": np.nan, "Ab8": np.nan, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Government and Public Administration", 
     "P1": "C", "P2": "I", "P3": "E", 
     "Ab1": 2, "Ab2": 1, "Ab3": 4, "Ab4": np.nan, "Ab5": 5, "Ab6": 3, "Ab7": np.nan, "Ab8": np.nan, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Marketing", 
     "P1": "E", "P2": "S", "P3": "A", 
     "Ab1": 1, "Ab2": 2, "Ab3": 4, "Ab4": 3, "Ab5": np.nan, "Ab6": 5, "Ab7": np.nan, "Ab8": np.nan, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Entrepreneurship", 
     "P1": "E", "P2": "S", "P3": "I", 
     "Ab1": 2, "Ab2": 1, "Ab3": np.nan, "Ab4": 4, "Ab5": 3, "Ab6": 5, "Ab7": np.nan, "Ab8": np.nan, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Sales", 
     "P1": "E", "P2": "S", "P3": "I", 
     "Ab1": 1, "Ab2": 2, "Ab3": 5, "Ab4": np.nan, "Ab5": 3, "Ab6": 4, "Ab7": np.nan, "Ab8": np.nan, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Science and Mathematics", 
     "P1": "I", "P2": "C", "P3": "R", 
     "Ab1": np.nan, "Ab2": 3, "Ab3": np.nan, "Ab4": 1, "Ab5": np.nan, "Ab6": 2, "Ab7": 4, "Ab8": np.nan, "Ab9": 5, "Ab10": np.nan},
     
    {"Pathway": "Computer Science, IT and Allied Fields", 
     "P1": "I", "P2": "R", "P3": "C", 
     "Ab1": 2, "Ab2": 4, "Ab3": 5, "Ab4": np.nan, "Ab5": np.nan, "Ab6": 3, "Ab7": np.nan, "Ab8": 1, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Life Sciences /Medicine and Healthcare", 
     "P1": "I", "P2": "R", "P3": "S", 
     "Ab1": 4, "Ab2": 2, "Ab3": 5, "Ab4": np.nan, "Ab5": np.nan, "Ab6": 3, "Ab7": 1, "Ab8": np.nan, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Environmental Service", 
     "P1": "I", "P2": "R", "P3": "S", 
     "Ab1": np.nan, "Ab2": 1, "Ab3": 5, "Ab4": np.nan, "Ab5": np.nan, "Ab6": np.nan, "Ab7": 2, "Ab8": np.nan, "Ab9": 3, "Ab10": 4},
     
    {"Pathway": "Social Sciences and Humanities", 
     "P1": "I", "P2": "S", "P3": "A", 
     "Ab1": 1, "Ab2": 2, "Ab3": 5, "Ab4": 3, "Ab5": np.nan, "Ab6": 4, "Ab7": np.nan, "Ab8": np.nan, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Defence/ Protective Service", 
     "P1": "R", "P2": "C", "P3": "S", 
     "Ab1": 4, "Ab2": 1, "Ab3": 3, "Ab4": np.nan, "Ab5": 5, "Ab6": np.nan, "Ab7": 2, "Ab8": np.nan, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Sports", 
     "P1": "R", "P2": "E", "P3": "S", 
     "Ab1": 5, "Ab2": 2, "Ab3": 3, "Ab4": np.nan, "Ab5": np.nan, "Ab6": np.nan, "Ab7": np.nan, "Ab8": np.nan, "Ab9": 1, "Ab10": 4},
     
    {"Pathway": "Engineering and Technology", 
     "P1": "R", "P2": "I", "P3": "C", 
     "Ab1": np.nan, "Ab2": 4, "Ab3": 5, "Ab4": np.nan, "Ab5": 2, "Ab6": 3, "Ab7": np.nan, "Ab8": 1, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Agriculture, Food Industry and Forestry", 
     "P1": "R", "P2": "I", "P3": "E", 
     "Ab1": np.nan, "Ab2": np.nan, "Ab3": np.nan, "Ab4": np.nan, "Ab5": np.nan, "Ab6": np.nan, "Ab7": np.nan, "Ab8": np.nan, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Education and Training", 
     "P1": "S", "P2": "A", "P3": "I", 
     "Ab1": 1, "Ab2": 4, "Ab3": 5, "Ab4": 2, "Ab5": np.nan, "Ab6": 3, "Ab7": np.nan, "Ab8": np.nan, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Paramedical", 
     "P1": "S", "P2": "I", "P3": "R", 
     "Ab1": 3, "Ab2": 2, "Ab3": 5, "Ab4": np.nan, "Ab5": 4, "Ab6": 1, "Ab7": np.nan, "Ab8": np.nan, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Hospitality and Tourism", 
     "P1": "S", "P2": "R", "P3": "A", 
     "Ab1": 1, "Ab2": 4, "Ab3": 3, "Ab4": 2, "Ab5": np.nan, "Ab6": np.nan, "Ab7": 5, "Ab8": np.nan, "Ab9": np.nan, "Ab10": np.nan},
     
    {"Pathway": "Community and Social Service", 
     "P1": "S", "P2": "R", "P3": "E", 
     "Ab1": 1, "Ab2": 3, "Ab3": 4, "Ab4": 2, "Ab5": np.nan, "Ab6": np.nan, "Ab7": 5, "Ab8": np.nan, "Ab9": 2, "Ab10": np.nan},
     
    {"Pathway": "Personal Care and Services", 
     "P1": "S", "P2": "R", "P3": "E", 
     "Ab1": 1, "Ab2": np.nan, "Ab3": 5, "Ab4": 4, "Ab5": np.nan, "Ab6": np.nan, "Ab7": 3, "Ab8": np.nan, "Ab9": 2, "Ab10": np.nan}
]

df_mapping = pd.DataFrame(mapping_data)

# Define ability mapping
ability_mapping = {
    "Communication": "Ab1",
    "Decision making & problem solving": "Ab2",
    "Speed and accuracy": "Ab3",
    "Creativity": "Ab4",
    "Computational": "Ab5",
    "Logical reasoning": "Ab6",
    "Form perception": "Ab7",
    "Technical": "Ab8",
    "Motor movement": "Ab9",
    "Finger dexterity": "Ab10"
}

# Predefined order sequences for personality match codes
predefined_full_order = [(1,2,3), (1,3,2), (2,1,3), (2,3,1), (3,1,2), (3,2,1)]
predefined_pair_order = [(1,2), (1,3), (2,1), (2,3), (3,1), (3,2)]
predefined_single_order = [(1,), (2,), (3,)]

def get_personality_match_key(candidate_personality, student_personality_rank):
    """Get personality match key for sorting"""
    match = []
    for p in candidate_personality:
        if p in student_personality_rank:
            match.append(student_personality_rank[p])
    match_code = tuple(match)
    n = len(match_code)
    
    # Determine order index from predefined lists
    order_index = 999  # default high value if not found
    if n == 3:
        if match_code in predefined_full_order:
            order_index = predefined_full_order.index(match_code)
    elif n == 2:
        if match_code in predefined_pair_order:
            order_index = predefined_pair_order.index(match_code)
    elif n == 1:
        if match_code in predefined_single_order:
            order_index = predefined_single_order.index(match_code)
    
    return match_code, (-n, order_index)

def get_tie_breaker_key(candidate_row, student_top5_abilities):
    """Get tie-breaker key for sorting"""
    mapping_ability_order = ["Ab1", "Ab2", "Ab3", "Ab4", "Ab5", "Ab6", "Ab7", "Ab8", "Ab9", "Ab10"]
    
    info = []
    for i, ab in enumerate(student_top5_abilities):
        rank = candidate_row.get(ab)
        if pd.notna(rank):
            pos = mapping_ability_order.index(ab)
            info.append((rank, pos, i))
    if not info:
        return (999, 999, 999, 999)
    
    # sort by rank, then by mapping position, then by student's order
    info_sorted = sorted(info, key=lambda x: (x[0], x[1], x[2]))
    min_rank, min_pos, min_student_index = info_sorted[0]
    count = len(info)
    summation = sum(item[0] for item in info)
    
    return (min_rank, min_pos, -count, summation, tuple(item[0] for item in info_sorted))

# Dictionary to convert full personality names to one-letter codes
personality_full_to_code = {
    "Realistic": "R",
    "Investigative": "I", 
    "Artistic": "A",
    "Social": "S",
    "Enterprising": "E",
    "Conventional": "C"
}

print("  Calculating suitability scores using original logic...")

# Process each student row to compute suitability ranking
suit_cols = [f"suitability_index_{i}" for i in range(1,10)]

# Prepare lists to store new column values for each student row
suitability_results = {col: [] for col in suit_cols}

# Loop over each student
for idx, student in df.iterrows():
    # Get student's top 3 personalities and convert to codes
    student_personalities = []
    for col in ["Personality_Top1", "Personality_Top2", "Personality_Top3"]:
        p = student[col]
        # Convert full name to single-letter code if needed
        if isinstance(p, str) and len(p) > 1:
            p = personality_full_to_code.get(p, p)
        student_personalities.append(p)
        
    # Create a rank dict: e.g. {'I':1, 'E':2, 'S':3}
    student_personality_rank = {p: i+1 for i, p in enumerate(student_personalities)}
    
    # Determine student's top 5 abilities
    ability_scores = {}
    for col, ab_key in ability_mapping.items():
        ability_scores[ab_key] = student.get(col, np.nan)
    
    # Sort abilities by score descending
    sorted_abilities = sorted(ability_scores.items(), key=lambda x: x[1] if pd.notna(x[1]) else -999, reverse=True)
    student_top5_abilities = [ab for ab, score in sorted_abilities if pd.notna(score)][:5]
    
    # Filter candidate pathways: select those where P1 matches student's top personalities
    candidates = df_mapping[df_mapping["P1"].isin(student_personalities)].copy()
    
    candidate_list = []
    
    # For each candidate, compute personality match key and tie-breaker key
    for _, cand in candidates.iterrows():
        cand_personality = [cand["P1"], cand["P2"], cand["P3"]]
        match_code, personality_key = get_personality_match_key(cand_personality, student_personality_rank)
        tb_key = get_tie_breaker_key(cand, student_top5_abilities)
        
        overall_key = (personality_key, tb_key)
        candidate_list.append({
            "Pathway": cand["Pathway"],
            "overall_key": overall_key
        })
    
    # Sort candidate_list by overall_key
    candidate_list_sorted = sorted(candidate_list, key=lambda x: x["overall_key"])
    
    # Pick top 9 candidates (if fewer than 9, fill with empty strings)
    top_candidates = [c["Pathway"] for c in candidate_list_sorted][:9]
    while len(top_candidates) < 9:
        top_candidates.append("")
    
    # Save the nine rankings into our new columns
    for i, col in enumerate(suit_cols):
        suitability_results[col].append(top_candidates[i])

# Add the suitability results to dataframe
for col in suit_cols:
    df[col] = suitability_results[col]

print(f"  ✅ Calculated suitability scores using original mapping table logic")
print(f"  ✅ Ranked top pathways for {len(df)} students")

# ============================================================================
# STEP 6: WEAK ABILITY IDENTIFICATION
# ============================================================================
print("\nStep 6/6: Identifying Weak Abilities...")

# For each student, compare their top 5 abilities with top 3 CP requirements
# This requires loading career pathway requirements
import json

with open('data/career_pathways.json', 'r') as f:
    career_pathways_data = json.load(f)['career_pathways']

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
    'Entertainment and Mass Media': 'entertainment_and_mass_media',
    'Management and Administration': 'management_and_administration'
}

def normalize_ability(ability):
    """Normalize ability name for comparison"""
    if isinstance(ability, dict):
        return ability.get('english', '').lower().strip()
    return str(ability).lower().strip()

# Identify weak ability
for idx, row in df.iterrows():
    student_abilities = []
    for i in range(1, 6):
        col_name = f'Ability_Top{i}'
        if col_name in row.index:
            val = row[col_name]
            # Handle case where val might be a Series
            if isinstance(val, pd.Series):
                val = val.iloc[0] if len(val) > 0 else ''
            if pd.notnull(val) and val != '':
                student_abilities.append(val)
    student_abilities_norm = [normalize_ability(a) for a in student_abilities]
    
    # Get top 3 career pathways
    top_pathways = []
    for i in range(1, 4):
        col_name = f'suitability_index_{i}'
        if col_name in row.index:
            val = row[col_name]
            # Handle case where val might be a Series
            if isinstance(val, pd.Series):
                val = val.iloc[0] if len(val) > 0 else ''
            if pd.notnull(val) and val != '':
                top_pathways.append(val)
    
    # Collect all required abilities from top 3 pathways
    required_abilities = set()
    for pathway_name in top_pathways:
        if pathway_name:
            json_key = pathway_mapping.get(pathway_name, pathway_name.lower().replace(' ', '_').replace('/', '_'))
            if json_key in career_pathways_data:
                pathway_data = career_pathways_data[json_key]
                if 'abilities' in pathway_data:
                    for ability in pathway_data['abilities']:
                        required_abilities.add(normalize_ability(ability))
    
    # Find abilities that are required but not in student's top 5
    weak_abilities = required_abilities - set(student_abilities_norm)
    
    if weak_abilities:
        # Pick the first weak ability (you may want more sophisticated logic)
        weak_ability = list(weak_abilities)[0].title().replace('_', ' ')
        # Try to match back to original naming
        ability_columns = [
            'Form perception', 'Computational', 'Motor movement', 'Creativity',
            'Speed and accuracy', 'Communication', 'Decision making & problem solving',
            'Technical', 'Logical reasoning', 'Finger dexterity'
        ]
        for ability in ability_columns:
            if normalize_ability(ability) == list(weak_abilities)[0]:
                weak_ability = ability
                break
        df.at[idx, 'Weak_Ability'] = weak_ability
        df.at[idx, 'Weak_Ability_Log'] = f"Missing: {', '.join([a.title() for a in list(weak_abilities)[:3]])}"
    else:
        df.at[idx, 'Weak_Ability'] = ''
        df.at[idx, 'Weak_Ability_Log'] = 'No weak abilities identified'

print(f"  ✅ Identified weak abilities for {len(df)} students")

# ============================================================================
# SAVE RESULTS
# ============================================================================
print("\n" + "=" * 70)
print("Saving results...")

with pd.ExcelWriter(INPUT_FILE, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
    df.to_excel(writer, sheet_name='top_personality', index=False)
    df.to_excel(writer, sheet_name='top_intelligence', index=False)
    df.to_excel(writer, sheet_name='preferences', index=False)
    df.to_excel(writer, sheet_name='ability', index=False)
    df.to_excel(writer, sheet_name='suitability_index', index=False)

print(f"✅ Phase 1 Complete!")
print(f"   Output: {INPUT_FILE}")
print(f"   Sheets: top_personality, top_intelligence, preferences, ability, suitability_index")
print(f"   Students processed: {len(df)}")
print(f"   Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 70)