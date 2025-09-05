import { useState } from "react";
import { Dropdown1 } from "../../../_metronic/partials";
// var _ = require('underscore');

const MarksTable = (props: { sem: any; result: any }) => {
  // var [data2, setData2] = useState();
  // console.log(props.result, "hi")

  return (
    <>
      <div className="container">
        <div className="row">
          <div className="col-sm">CODE</div>
          <div className="col-sm">NAME </div>
          <div className="col-sm">TYPE </div>
          <div className="col-sm">INTERNAL</div>
          <div className="col-sm">EXTERNAL </div>
          <div className="col-sm">BACK PAPER</div>
          <div className="col-sm">GRADE</div>
          <div className="w-100"></div>
        </div>
        {props.result.length >= 2
          ? props.result[1].marks.map((data: any) => (
              <>
                <div className="row">
                  <div className="col-sm">{data.code}</div>
                  <div className="col-sm">{data.name}</div>
                  <div className="col-sm">{data.type}</div>
                  <div className="col-sm">{data.internal}</div>
                  <div className="col-sm">{data.external}</div>
                  <div className="col-sm">{data.back_paper}</div>
                  <div className="col-sm">{data.grade}</div>
                </div>
              </>
            ))
          : props.result[0].marks.map((data: any) => (
              <>
                <div className="row">
                  <div className="col-sm">{data.code}</div>
                  <div className="col-sm">{data.name}</div>
                  <div className="col-sm">{data.type}</div>
                  <div className="col-sm">{data.internal}</div>
                  <div className="col-sm">{data.external}</div>
                  <div className="col-sm">--</div>
                  <div className="col-sm">{data.grade}</div>
                </div>
              </>
            ))}
      </div>
    </>
  );
};

export default MarksTable;
