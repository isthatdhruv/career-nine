/*  */
const ThankYouPage = () => {
  return (
    <>
      <div className="d-flex flex-column flex-root" id="kt_app_root">
        {/* <style>body 
                {background - image: url('https://preview.keenthemes.com/metronic8/demo1/assets/media/auth/bg8.jpg'); } 
                [data-theme="dark"] 
                body {background - image: url('/metronic8/demo1/assets/media/auth/bg8-dark.jpg'); }
                </style> */}

        <div className="d-flex flex-column flex-center flex-column-fluid">
          <div className="d-flex flex-column flex-center text-center p-10">
            <div className="card card-flush w-md-650px py-5">
              <div className="card-body py-15 py-lg-20">
                <div className="mb-7">
                  <img
                    alt="Logo"
                    src="/media/logos/kcc.jpg"
                    className="h-80px"
                  />
                </div>
                <h1 className="fw-bolder text-gray-900 mb-5">
                  Thank You For Submitting!
                </h1>
                <div className="fw-semibold fs-6 text-gray-700 mb-7">
                  Your details have been{" "}
                  <span style={{ color: "rgb(126, 30, 30)" }}>submitted</span>.
                  They will be{" "}
                  <span style={{ color: "rgb(126, 30, 30)" }}>verified</span> by
                  the registrar within 1-2 working days. If any discrepancies or
                  defects are found, the registrar's office will mail you on
                  your given ID.
                  <div className="mb-0">
                    {/* <img src="https://media.istockphoto.com/vectors/vector-folded-hands-icon-on-a-white-background-vector-id1170697087?k=20&m=1170697087&s=612x612&w=0&h=moAI8OnApwLCMq659OsZw2Rxm44pez8gyRjnAZQ2diA=" className="mw-100 mh-300px theme-light-show" alt="" /> */}
                    {/* <img src="https://preview.keenthemes.com/metronic8/demo1/assets/media/auth/welcome-dark.png" className="mw-100 mh-300px theme-dark-show" alt="" /> */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export { ThankYouPage };
