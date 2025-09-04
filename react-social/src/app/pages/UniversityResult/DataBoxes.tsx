import React, { useEffect, useState } from "react";

export default function DataBoxes(props: { data }) {
  // console.log(props.data)
  return (
    <>
      <div className="col-xl-4">
        <div className="card card-flush h-xl-100">
          <div className="card-header pt-1">
            <h3 className="card-title align-items-start flex-column">
              <span className="card-label fw-bold text-dark">
                {props.data.header}
              </span>
            </h3>
          </div>
          <div className="card-body pt-2 pb-2">
            <div
              className=" d-flex flex-column  flex-center"
              style={{ fontSize: "xxx-large" }}
            >
              <span className="fw-bold text-dark">{props.data.body}</span>
            </div>
          </div>
          <div className="card-footer pt-2 pb-2">
            <div className=" d-flex flex-column  flex-left">
              <span className="fw-bolder text-gray-700 text-xxl-end ">
                {props.data.footer}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
