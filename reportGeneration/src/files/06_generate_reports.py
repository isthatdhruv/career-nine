#!/usr/bin/env python3
"""
Phase 6: Report Generation
Class-aware report generation orchestrator
Input: Master_Sheet with all enriched data
Output: Individual Word reports per student
Routes students to appropriate templates:
  - Class 9-10 → report_9-10.py → Templates/9-10.docx → Stream Navigator
  - Class 11-12 → report_11-12.py → Templates/11-12.docx → Career Navigator
"""

import subprocess
import sys
import os
import pandas as pd
from datetime import datetime

print("=" * 70)
print("PHASE 6: REPORT GENERATION")
print("=" * 70)
print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print()


# ============================================================================
# VERIFY PREREQUISITES
# ============================================================================
print("Verifying prerequisites...")

# Check templates exist
templates = {
    '6-8': 'Templates/HTML Templates/6-8.html',
    '9-10': 'Templates/HTML Templates/9-10.html',
    '11-12': 'Templates/HTML Templates/11-12.html',
}

for class_group, template_path in templates.items():
    if os.path.exists(template_path):
        print(f"  ✅ {class_group} template: {template_path}")
    elif class_group == '9-10':
        print(f"  ❌ Missing template: {template_path}")
        exit(1)
    else:
        print(f"  ⚠️  Missing template: {template_path} (Skipping)")

# Check report scripts exist
report_scripts = {
    '6-8': 'final_report_scripts/report_6-8_html.py',
    '9-10': 'final_report_scripts/report_9-10_html.py',
    '11-12': 'final_report_scripts/report_11-12_html.py',
}

for class_group, script_path in report_scripts.items():
    if os.path.exists(script_path):
        print(f"  ✅ {class_group} report script: {script_path}")
    else:
        print(f"  ❌ Missing script: {script_path}")
        exit(1)

# Check master sheet exists
INPUT_FILE = "input.xlsx"
if not os.path.exists(INPUT_FILE):
    print(f"  ❌ Master file not found: {INPUT_FILE}")
    exit(1)

df = pd.read_excel(INPUT_FILE, sheet_name='Master_Sheet')
print(f"  ✅ Master_Sheet loaded: {len(df)} students")

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
    class_num = row['Class']
    
    if class_num in [6, 7, 8]:
        students_by_group['6-8'].append(name)
        print(f"  {name} (Class {class_num}) → 6-8 group")
    elif class_num in [9, 10]:
        students_by_group['9-10'].append(name)
        print(f"  {name} (Class {class_num}) → 9-10 group")
    elif class_num in [11, 12]:
        students_by_group['11-12'].append(name)
        print(f"  {name} (Class {class_num}) → 11-12 group")
    else:
        print(f"  ⚠️ {name} (Class {class_num}) → Skipped (Only Class 6-8, 9-10 & 11-12 HTML Supported)")

print()
print(f"  Class 6-8: {len(students_by_group['6-8'])} students")
print(f"  Class 9-10: {len(students_by_group['9-10'])} students")
print(f"  Class 11-12: {len(students_by_group['11-12'])} students")

# ============================================================================
# GENERATE REPORTS
# ============================================================================
print("\n" + "=" * 70)
print("Generating reports...")
print()

total_generated = 0
total_failed = 0

# Generate reports for each class group
for class_group, students in students_by_group.items():
    if not students:
        print(f"Skipping {class_group} (no students)")
        continue
    
    script_path = report_scripts[class_group]
    if class_group == "6-8":
        report_type = "Insight Navigator (HTML)"
    elif class_group == "9-10":
        report_type = "Stream Navigator (HTML)"
    elif class_group == "11-12":
        report_type = "Career Navigator (HTML)"
    else:
        report_type = "Unknown"
    
    print(f"Generating {class_group} reports ({report_type})...")
    print(f"  Students: {', '.join(students)}")
    print(f"  Script: {script_path}")
    print()
    
    try:
        # Change to script directory and run
        script_dir = os.path.dirname(script_path)
        script_name = os.path.basename(script_path)
        
        original_dir = os.getcwd()
        os.chdir(script_dir)
        
        result = subprocess.run(
            [sys.executable, script_name],
            capture_output=True,
            text=True
        )
        
        os.chdir(original_dir)
        
        if result.returncode == 0:
            print(f"  ✅ {class_group} reports generated successfully")
            total_generated += len(students)
            
            # Show last few lines of output
            output_lines = result.stdout.strip().split('\n')
            for line in output_lines:
                if "JSON_RESULT:" in line:
                    print(line)  # Pass through the JSON result
                elif line.strip():
                    # Only show last few non-JSON lines if needed, or just log them
                    pass
            
            # Print last few lines for visibility (excluding JSON)
            for line in output_lines[-3:]:
                if line.strip() and "JSON_RESULT:" not in line:
                    print(f"     {line}")
        else:
            print(f"  ❌ {class_group} reports failed")
            print(f"     Error: {result.stderr[:200]}")
            total_failed += len(students)
        
        print()
        
    except Exception as e:
        print(f"  ❌ Error running {class_group} script: {e}")
        total_failed += len(students)
        print()

# ============================================================================
# SUMMARY
# ============================================================================
print("=" * 70)
print("REPORT GENERATION SUMMARY")
print("=" * 70)
print(f"✅ Successfully generated: {total_generated} reports")
if total_failed > 0:
    print(f"❌ Failed: {total_failed} reports")
print()
print(f"📁 Output directory: Reports/english/")
print(f"📊 Graphs directory: graphs/")
print()

# List generated files
try:
    reports_dir = "Reports/english"
    if os.path.exists(reports_dir):
        files = [f for f in os.listdir(reports_dir) if f.endswith('.html') and 'Career-9' in f and not f.startswith('~$')]
        
        print(f"📄 Generated Reports ({len(files)}):")
        for file in sorted(files):
            size_mb = os.path.getsize(os.path.join(reports_dir, file)) / (1024 * 1024)
            print(f"  • {file} ({size_mb:.2f} MB)")
except Exception as e:
    print(f"⚠️ Could not list report files: {e}")

print()
print(f"✅ Phase 6 Complete!")
print(f"   Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 70)