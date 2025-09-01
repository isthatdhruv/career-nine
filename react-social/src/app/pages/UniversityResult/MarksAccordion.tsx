import Accordion from "react-bootstrap/Accordion";
import MarksTable from "./MarksTable";

const MarksAccordion = (props: { sem: any; result: any }) => {
  // console.log(props.sem)
  return (
    <>
      <Accordion defaultActiveKey="0">
        <Accordion.Item eventKey="1">
          <Accordion.Header>
            <strong>&nbsp;SESSION:</strong>
            {props.result[0].session}
            <strong>&nbsp;SEMESTER:</strong>
            {props.sem}
            <strong>&nbsp;RESULT:</strong>
            {props.result[0].result_status}
          </Accordion.Header>
          <Accordion.Body style={{ backgroundColor: "#DFE7F9" }}>
            {/* marks container */}
            <div className="marks-container">
              {/* data container */}
              <div className="data">
                <div className="row" style={{ paddingBottom: "5px" }}>
                  <div className="col">
                    <strong>Theory Subject:</strong>
                    {props.result[0].theory_subjects}
                  </div>
                  <div className="col">
                    <strong>Practical Subject:</strong>
                    {props.result[0].practical_subjects}
                  </div>
                </div>
                <div className="row" style={{ paddingBottom: "5px" }}>
                  <div className="col">
                    <strong>Marks Obtained:</strong>
                    {props.result[0].total_marks_obt}
                  </div>
                  <div className="col">
                    <strong>Total Marks:</strong>
                  </div>
                </div>
                <div className="row" style={{ paddingBottom: "5px" }}>
                  <div className="col">
                    <strong>SGPA:</strong>
                    {props.result[0].SGPA}
                  </div>
                  <div className="col">
                    <strong>Date of Declaration:</strong>
                    {props.result[0].date_of_declaration}
                  </div>
                </div>
              </div>
              <hr></hr>

              {/* table */}
              <div className="table" style={{}}>
                <MarksTable sem={props.sem} result={props.result} />
              </div>
            </div>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </>
  );
};

export default MarksAccordion;
