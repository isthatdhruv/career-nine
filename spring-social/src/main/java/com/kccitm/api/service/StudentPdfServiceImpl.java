// package com.kccitm.api.service;

// import java.io.FileNotFoundException;
// import java.io.FileOutputStream;
// import java.io.IOException;
// import java.net.MalformedURLException;
// import java.util.List;

// import org.springframework.beans.factory.annotation.Autowired;
// import org.springframework.stereotype.Service;

// import com.itextpdf.text.Document;
// import com.itextpdf.text.DocumentException;
// import com.itextpdf.text.Element;
// import com.itextpdf.text.Font;
// import com.itextpdf.text.Image;
// import com.itextpdf.text.PageSize;
// import com.itextpdf.text.Paragraph;
// import com.itextpdf.text.Phrase;
// import com.itextpdf.text.pdf.PdfPCell;
// import com.itextpdf.text.pdf.PdfPTable;
// import com.itextpdf.text.pdf.PdfWriter;
// import com.kccitm.api.model.Student;
// import com.kccitm.api.repository.StudentRepository;
// // import com.itextpdf.layout.border.Border; 
// // import com.itextpdf.layout.border.DashedBorder;

// @Service
// public class StudentPdfServiceImpl implements StudentPdfService {

// 	@Autowired
// 	private StudentRepository studentRepository;

// 	public static PdfPCell getCell(String text, int alignment) {
// 		PdfPCell cell = new PdfPCell(new Phrase(text));
// 		cell.setPadding(0);
// 		cell.setHorizontalAlignment(alignment);
// 		// Border b1 = new DashedBorder(Color.RED, 3);
// 		// cell.setBorder();
// 		return cell;
// 	}

// 	private static Font Bold = new Font(Font.FontFamily.TIMES_ROMAN, 20,
// 			Font.BOLD | Font.UNDERLINE);
// 	private static Font smallBold = new Font(Font.FontFamily.TIMES_ROMAN, 13,
// 			Font.BOLD | Font.UNDERLINE);

// 	public void genrerateStudentIDPDF(long roll_no) throws DocumentException, MalformedURLException, IOException {
// 		List<Student> Lstudnet = studentRepository.findAll();
// 		// List<Student> st =
// 		// Lstudnet.stream().filter(p->p.getRoll_No_()==roll_no).collect(Collectors.toList());
// 		Student st = Lstudnet.get(1);

// 		String date, sname, fathername, batch, session, address, phoneNumber, emailId;
// 		long rollno;

// 		// Date dt= new Date();
// 		// date=dt.getDay()+;
// 		sname = st.getFirstName() + " " + st.getLastName();
// 		System.out.println("hello brother" + sname);
// 		fathername = st.getFatherName();
// 		batch = st.getBatch();
// 		// rollno = st.getRoll_No_();
// 		System.out.println("hello brother" + rollno);
// 		address = st.getCurrentAddress();
// 		phoneNumber = st.getPhoneNumber();
// 		emailId = st.getEmailAddress();

// 		Document doc = new Document(PageSize.A4.rotate(), 10f, 10f, 100f, 0f); // created PDF document instance
// 		try {
// 			FileOutputStream fos = new FileOutputStream(
// 					"/home/kcc/kccitmProject-1/spring-social/src/main/java/com/kccitm/api/Pdf/.pdf"); // output path+ file_name

// 			PdfWriter writer = PdfWriter.getInstance(doc, fos);
// 			doc.open(); // opens the PDF

// 			Paragraph paragraph = new Paragraph("KCC Institute of Technology & Management", Bold);
// 			doc.add(paragraph);

// 			Image img = Image
// 					.getInstance("/home/kcc/kccitmProject-1/spring-social/src/main/java/com/kccitm/api/Pdf/KCC.jpg"); // Logo-image
// 																														// path
// 			img.setAbsolutePosition(480, 750);
// 			img.scaleToFit(80, 180);
// 			doc.add(img);

// 			doc.add(new Paragraph("\n"));
// 			Paragraph paragraph1 = new Paragraph(sname + " Library Card", smallBold);
// 			paragraph1.setAlignment(Element.ALIGN_CENTER);
// 			doc.add(paragraph1);
// 			doc.add(new Paragraph("\n"));

// 			PdfPTable table = new PdfPTable(2);
// 			table.setWidthPercentage(100);
// 			table.addCell(getCell("The Registrar,", PdfPCell.ALIGN_LEFT));
// 			// table.addCell(getCell("Date: "+date, PdfPCell.ALIGN_RIGHT));
// 			doc.add(table);

// 			PdfPTable table1 = new PdfPTable(1);
// 			table1.setWidthPercentage(100);
// 			table1.addCell(getCell("\n", PdfPCell.ALIGN_LEFT));
// 			table1.addCell(getCell("KCC Institute of Technology & Management", PdfPCell.ALIGN_LEFT));
// 			table1.addCell(getCell("Knowledge Park-III", PdfPCell.ALIGN_LEFT));
// 			table1.addCell(getCell("Greater Noida,", PdfPCell.ALIGN_LEFT));
// 			table1.addCell(getCell("UP-201306", PdfPCell.ALIGN_LEFT));
// 			table1.addCell(getCell("\n", PdfPCell.ALIGN_LEFT));
// 			table1.addCell(getCell("Sir,", PdfPCell.ALIGN_LEFT));
// 			doc.add(table1);

// 			int space = 20;
// 			int sleft = 0;
// 			String spleft = "", spright = "";
// 			space = space - sname.length();
// 			sleft = space / 2;

// 			for (int i = 0; i < sleft; i++) {
// 				spleft = spleft + " ";
// 				spright = spright + " ";
// 			}

// 			// doc.add(new Paragraph("I "+spleft+sname+spright+" S/D/o
// 			// "+spleft+fathername+spright+" Student of B.Tech "+spleft+year +" YEAR "));
// 			// doc.add(new Paragraph("Session "+spleft+session+spright+ " University Roll No
// 			// "+spleft+rollno+ "\n"));
// 			// doc.add(new Paragraph("Kindly give me the following Documents:-"));

// 			// doc.add(new Paragraph("1) "+s1));
// 			// doc.add(new Paragraph("\n"));
// 			// doc.add(new Paragraph("2) "+s2));
// 			// doc.add(new Paragraph("\n"));
// 			// doc.add(new Paragraph("3) "+s3));
// 			// doc.add(new Paragraph("\n"));
// 			// doc.add(new Paragraph("4) "+s4));
// 			// doc.add(new Paragraph("\n"));
// 			// doc.add(new Paragraph("Degree "));
// 			// doc.add(new Paragraph(" \n \n \n "));

// 			// PdfPTable table2 = new PdfPTable(2);
// 			// table2.setWidthPercentage(100);
// 			// table2.addCell(getCell(("Account Dues: "+ad), PdfPCell.ALIGN_LEFT));
// 			// table2.addCell(getCell(("Library Dues: "+ld), PdfPCell.ALIGN_RIGHT));
// 			// doc.add(table2);

// 			PdfPTable table3 = new PdfPTable(1);
// 			table3.setWidthPercentage(100);
// 			table3.addCell(getCell(("\n"), PdfPCell.ALIGN_LEFT));
// 			table3.addCell(getCell(("Thanking You"), PdfPCell.ALIGN_LEFT));
// 			table3.addCell(getCell(("\n"), PdfPCell.ALIGN_LEFT));
// 			table3.addCell(getCell((sname), PdfPCell.ALIGN_LEFT));
// 			// table3.addCell(getCell(("Phone no: "+ph), PdfPCell.ALIGN_LEFT));
// 			// table3.addCell(getCell(("Address: "+add), PdfPCell.ALIGN_LEFT));
// 			table3.addCell(getCell(("University Roll No: " + rollno), PdfPCell.ALIGN_LEFT));
// 			doc.add(table3);
// 			doc.close(); // close the PDF
// 			writer.close(); // close the writer
// 		} catch (DocumentException e) {
// 			e.printStackTrace();
// 		} catch (FileNotFoundException e) {
// 			e.printStackTrace();
// 		}
// 	}
// }
