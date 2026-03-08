# Assessment Questions Bulk Upload Feature

## Overview

The Bulk Upload feature allows you to upload multiple assessment questions from an Excel file, with the ability to preview and edit each question before submitting to the database.

## Features

- ✅ Upload Excel files with multiple questions (one row per question)
- ✅ Preview and edit questions before submission
- ✅ Navigate through questions with Next/Previous buttons
- ✅ Add/remove options for each question
- ✅ Configure Measured Quality Type (MQT) scores for each option
- ✅ See total question count
- ✅ Track upload progress and view success/failure results
- ✅ Download blank template to get started

## How to Use

### Step 1: Download the Template

1. Navigate to the Assessment Questions page
2. Click the **"Download Template"** button (blue button with download icon)
3. An Excel file named `questions_template_YYYY-MM-DD.xlsx` will be downloaded
4. Open the template in Excel/Google Sheets

### Step 2: Fill in Your Questions

The Excel template has the following columns:

#### Required Columns:
- **Question Text**: The question text (required)
- **Question Type**: One of: `multiple-choice`, `single-choice`, or `ranking`
- **Section ID**: Numeric ID of the section (get from the Sections page)

#### Optional Columns:
- **Max Options Allowed**: Number (default: 0)
- **Option 1 Text**: Text for first option
- **Option 1 Description**: Description for first option (optional)
- **Option 1 Is Correct**: "Yes" or "No" (optional)
- **Option 1 MQTs**: MQT scores in format `MQTName:Score,MQTName:Score` (e.g., "Analytical:10,Creativity:5")
- **Option 2 Text**, **Option 2 Description**, **Option 2 Is Correct**, **Option 2 MQTs**: Same pattern for option 2
- ... (repeat for Options 3, 4, 5, 6)

#### Example Excel Data:

| Question Text | Question Type | Section ID | Max Options Allowed | Option 1 Text | Option 1 Description | Option 1 Is Correct | Option 1 MQTs | Option 2 Text | Option 2 Description | Option 2 Is Correct | Option 2 MQTs |
|--------------|---------------|------------|---------------------|---------------|---------------------|---------------------|---------------|---------------|---------------------|---------------------|---------------|
| What is 2+2? | single-choice | 1 | 1 | 4 | Correct answer | Yes | Analytical:10,Problem Solving:8 | 5 | Wrong answer | No | Analytical:2 |
| Choose your favorite colors | multiple-choice | 2 | 3 | Red | | No | Creativity:5 | Blue | | No | Creativity:8 |

### Step 3: Upload and Preview

1. Save your Excel file
2. Click the **"Upload Excel"** button on the Assessment Questions page
3. Select your Excel file
4. The system will parse the file and show you a success message with the number of questions found
5. A modal will open showing the first question

### Step 4: Review and Edit Questions

In the modal, you can:
- See "Question X of N" at the top
- Review the question text, type, and section
- Edit any field if needed
- Add or remove options using the + and - buttons
- Configure MQT scores for each option using the "MQT" dropdown
- Navigate between questions using **"Previous"** and **"Next"** buttons
- All changes are automatically saved as you navigate

### Step 5: Submit

1. After reviewing all questions (or at any time), click **"Submit All (N questions)"**
2. The system will upload each question to the server
3. A progress indicator will show during upload
4. After completion, you'll see a results summary:
   - ✅ Success count
   - ❌ Failed count (if any)
   - Error messages for failed questions
5. The questions table will automatically refresh to show the new questions

## Excel Format Details

### MQT Scores Format

To add MQT scores to an option, use this format in the "Option X MQTs" column:

```
MQTName1:Score1,MQTName2:Score2,MQTName3:Score3
```

**Example:**
```
Analytical:10,Creativity:5,Leadership:8,Problem Solving:12
```

**Notes:**
- MQT names must match existing measured quality types in the system (case-insensitive)
- Scores should be numeric (0-100)
- Separate multiple MQTs with commas
- No spaces around colons or commas (they'll be trimmed automatically)
- If MQT name doesn't match, it will be ignored

### Question Types

Valid question types:
- `multiple-choice` - Allows selecting multiple options
- `single-choice` - Allows selecting only one option
- `ranking` - For ranking options

### Is Correct Field

Valid values for "Option X Is Correct":
- `Yes`, `yes`, `YES`, `true`, `TRUE` → Marked as correct
- Anything else → Not marked as correct

### Maximum Options

Supports up to **6 options per question** in the Excel format.

If you need more options, you can:
- Add them in the preview modal before submitting
- Or edit the question after upload

## Limitations

- **Images NOT supported**: The Excel format doesn't support image options. Add images via the Edit page after upload.
- **Max 6 options in Excel**: You can add more options in the modal or edit page.
- **No "Use MQT as Options" mode**: This advanced feature must be configured via the Create/Edit page.
- **Section ID must exist**: Make sure the Section ID in your Excel matches an existing section.

## Error Handling

### Common Errors:

1. **"Missing required columns"**
   - Solution: Make sure your Excel has at least: Question Text, Question Type, and Section ID columns

2. **"Section not found"**
   - Solution: Check that the Section ID exists in the Sections page

3. **"At least one option is required"**
   - Solution: Add at least one option (Option 1 Text must not be empty)

4. **"Invalid question type"**
   - Solution: Use one of: multiple-choice, single-choice, ranking

5. **"MQT not found"**
   - Solution: Check that MQT names in the "Option X MQTs" column match existing MQTs (check spelling)

### Partial Success

If some questions fail to upload:
- Successful questions will be saved
- Failed questions will be listed with error messages
- You can fix the errors and re-upload just the failed questions

## Tips & Best Practices

1. **Start Small**: Test with 2-3 questions first to verify the format
2. **Use Template**: Always download and use the provided template
3. **Check Section IDs**: Verify section IDs exist before bulk upload
4. **MQT Names**: Get exact MQT names from the Measured Quality Types page
5. **Review Before Submit**: Use the preview modal to check all questions
6. **Save Frequently**: Keep backups of your Excel files
7. **Copy Existing**: Use "Download Excel" to export existing questions as a reference

## Technical Details

### File Requirements:
- Format: `.xlsx` or `.xls`
- Size: Recommended < 5MB (will warn if larger)
- Structure: One row per question

### Backend Integration:
- Uses existing `/assessment-questions/create` API endpoint
- Each question is uploaded individually
- Progress tracked per question
- Automatic cache refresh after successful uploads

### Frontend Parsing:
- Parses Excel client-side using `xlsx` library
- Validates required columns before processing
- Groups options by question
- Converts MQT string format to structured data

## Troubleshooting

### Excel file not uploading?
- Check file extension (.xlsx or .xls)
- Try saving Excel file with "Save As" → Excel Workbook (.xlsx)
- Verify file isn't corrupted

### Modal not showing questions?
- Check browser console for errors
- Verify Excel structure matches template
- Try with the sample template first

### Questions not saving?
- Check network connection
- Verify backend server is running
- Check browser console for API errors
- Verify section IDs are valid

### MQT scores not appearing?
- Verify MQT names match exactly (case-insensitive)
- Check format: `Name:Score,Name:Score` (no extra spaces)
- View existing MQTs in the Measured Quality Types page

## Support

For issues or questions:
1. Check this documentation
2. Review console logs (F12 in browser)
3. Test with the provided template
4. Contact development team with:
   - Screenshots of errors
   - Sample Excel file (if possible)
   - Browser console logs

---

**Version**: 1.0
**Last Updated**: 2026-02-04
