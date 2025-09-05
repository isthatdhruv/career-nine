// package com.kccitm.api.model;

// import javax.persistence.Column;
// import javax.persistence.Entity;
// import javax.persistence.GeneratedValue;
// import javax.persistence.GenerationType;
// import javax.persistence.Id;
// import javax.persistence.JoinColumn;
// import javax.persistence.JoinTable;
// import javax.persistence.ManyToOne;
// import javax.persistence.OneToMany;
// import javax.persistence.Table;

// @Entity
// @Table(name = "CodingProblemTopicCodingProblemMapping")
// public class CodingProblemTopicCodingProblemMapping {

//     @Id
//     @Column(name = "id")
//     @GeneratedValue(strategy = GenerationType.IDENTITY)
//     private int id;

//     @ManyToOne
//     private Topic topic;

//     @ManyToOne
//     private CodingPlatformProblem codingPlateformProblem;

// public CodingPlateformProblem getCodingPlateformProblem() {
//     return codingPlateformProblem;
// }

//     public Topic gettopicName() {
//         return topic;
//     }

//     public int getId() {
//         return id;
//     }

// public void setCodingPlateformProblem(CodingPlateformProblem codingPlateformProblem) {
//     this.codingPlateformProblem = codingPlateformProblem;
// }

//     public void settopicName(Topic topicName) {
//         this.topic = topicName;
//     }

//     public void setId(int id) {
//         this.id = id;
//     }

// }
