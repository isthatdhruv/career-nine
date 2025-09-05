import React from 'react'
const API_URL = process.env.REACT_APP_API_URL;

const Img_URL = API_URL + "/util/file-get/getbyname/";

const StudentProfile = () => {
  return (
    <div className="card mb-5 mb-xl-10">
      <div className="card-body pt-9 pb-0">
        <div className="d-flex flex-wrap flex-sm-nowrap mb-3">
          {/* begin image */}

          <div className="me-7 mb-4">
            <div className="symbol symbol-100px symbol-lg-160px symbol-fixed position-relative">
            <img src={Img_URL} width='150-px' height='150-px' />
                <div className="position-absolute translate-middle bottom-0 start-100 mb-6 bg-success rounded-circle border border-4 border-body h-20px w-20px"></div>
            </div>
          </div>

          {/* end image */}

          {/* begin information */}

          <div className="flex-grow-1">
            <div className="d-flex justify-content-between align-items-start flex-wrap mb-2">
              <div className="d-flex flex-column">
                {/* begin name */}

                <div className="d-flex align-items-center mb-2">
                  <p className="text-gray-900 text-hover-primary fs-2 fw-bold me-1">
                    ABCD
                  </p>
                  <p
                    className="btn btn-sm btn-light-success fw-bold ms-2 fs-8 py-1 px-3"
                    data-bs-toggle="modal"
                  >
                    Verified By Registrar
                  </p>
                </div>

                {/* end name */}

                {/* begin info */}

                <div className="d-flex flex-wrap fw-semibold fs-6 mb-4 pe-2">
                  <p className="d-flex align-items-center text-gray-400 text-hover-primary me-5 mb-2">
                    <span className="svg-icon svg-icon-4 me-1"></span>
                    "Student"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
