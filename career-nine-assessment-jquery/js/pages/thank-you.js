// Career-9 Assessment - Thank You Page
Pages.thankYou = {
  render() {
    allowReload();
    clearAssessmentStorage();
    AppState.clearAssessment();

    $('#app-root').html(`
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
        min-height:100vh;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
        padding:20px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;
        position:relative;overflow:hidden;">

        <!-- Decorative circles -->
        <div class="float-circle" style="top:10%;left:5%;width:150px;height:150px;
          animation:float 6s ease-in-out infinite;"></div>
        <div class="float-circle" style="bottom:15%;right:8%;width:100px;height:100px;
          background:rgba(255,255,255,.08);animation:float 8s ease-in-out infinite reverse;"></div>
        <div class="float-circle" style="top:60%;left:10%;width:60px;height:60px;
          background:rgba(255,255,255,.06);animation:float 5s ease-in-out infinite;"></div>

        <div style="background:rgba(255,255,255,.98);padding:50px 60px;border-radius:28px;
          box-shadow:0 25px 80px rgba(0,0,0,.25);text-align:center;max-width:700px;width:100%;
          animation:fadeIn .8s ease-out;position:relative;z-index:1;" class="animate-fade">

          <!-- Checkmark -->
          <div class="animate-scale" style="width:90px;height:90px;border-radius:50%;
            background:linear-gradient(135deg,#10b981 0%,#059669 100%);
            display:flex;align-items:center;justify-content:center;
            margin:0 auto 25px auto;box-shadow:0 10px 30px rgba(16,185,129,.4);">
            <svg width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"
              stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>

          <img src="/media/logos/kcc.jpg" alt="Career-9 Logo"
            style="width:100px;height:100px;object-fit:contain;border-radius:16px;
            margin:0 auto 25px auto;display:block;box-shadow:0 8px 25px rgba(0,0,0,.1);">

          <h1 style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);
            -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
            font-size:2.8rem;margin-bottom:15px;font-weight:800;letter-spacing:-.5px;">
            🎉 Thank You!
          </h1>

          <p style="color:#4a5568;font-size:1.2rem;margin-bottom:15px;line-height:1.8;font-weight:500;">
            You have successfully completed your assessment.
          </p>
          <p style="color:#718096;font-size:1rem;margin-bottom:35px;line-height:1.6;">
            Your responses have been recorded securely.<br>
            Now explore your personalized insights and career possibilities!
          </p>

          <!-- Divider -->
          <div style="height:2px;background:linear-gradient(90deg,transparent,rgba(102,126,234,.3),transparent);
            margin:0 auto 35px auto;width:80%;"></div>

          <!-- Buttons -->
          <div style="display:flex;gap:20px;flex-wrap:wrap;justify-content:center;">
            <!-- Dashboard -->
            <div id="goto-dashboard"
              style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:20px;
              padding:25px 30px;cursor:pointer;transition:all .3s ease;
              box-shadow:0 10px 35px rgba(102,126,234,.4);flex:1;min-width:240px;max-width:280px;">
              <div style="width:50px;height:50px;border-radius:12px;background:rgba(255,255,255,.2);
                display:flex;align-items:center;justify-content:center;margin:0 auto 15px auto;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <rect x="3" y="3" width="7" height="9"/>
                  <rect x="14" y="3" width="7" height="5"/>
                  <rect x="14" y="12" width="7" height="9"/>
                  <rect x="3" y="16" width="7" height="5"/>
                </svg>
              </div>
              <h3 style="color:white;font-size:1.15rem;font-weight:700;margin-bottom:8px;">Go to Dashboard</h3>
              <p style="color:rgba(255,255,255,.85);font-size:.85rem;line-height:1.5;margin:0;">
                Comprehensive Student Insight Dashboard
              </p>
            </div>

            <!-- Career Library -->
            <div id="goto-library"
              style="background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);border-radius:20px;
              padding:25px 30px;cursor:pointer;transition:all .3s ease;
              box-shadow:0 10px 35px rgba(245,87,108,.4);flex:1;min-width:240px;max-width:280px;">
              <div style="width:50px;height:50px;border-radius:12px;background:rgba(255,255,255,.2);
                display:flex;align-items:center;justify-content:center;margin:0 auto 15px auto;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  <path d="M8 7h8"/><path d="M8 11h6"/>
                </svg>
              </div>
              <h3 style="color:white;font-size:1.15rem;font-weight:700;margin-bottom:8px;">Explore Career Library</h3>
              <p style="color:rgba(255,255,255,.85);font-size:.85rem;line-height:1.5;margin:0;">
                Explore 200+ career options from 44+ career categories
              </p>
            </div>
          </div>
        </div>

        <style>
          @keyframes fadeIn { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
          @keyframes scaleIn { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
          @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-20px)} }
        </style>
      </div>
    `);

    $('#goto-dashboard')
      .on('mouseenter', function() { $(this).css({ transform: 'translateY(-5px) scale(1.02)', boxShadow: '0 15px 45px rgba(102,126,234,.5)' }); })
      .on('mouseleave', function() { $(this).css({ transform: 'translateY(0) scale(1)', boxShadow: '0 10px 35px rgba(102,126,234,.4)' }); })
      .on('click', function() {
        // Navigate to dashboard — update URL as needed
        window.location.href = '/student-dashboard';
      });

    $('#goto-library')
      .on('mouseenter', function() { $(this).css({ transform: 'translateY(-5px) scale(1.02)', boxShadow: '0 15px 45px rgba(245,87,108,.5)' }); })
      .on('mouseleave', function() { $(this).css({ transform: 'translateY(0) scale(1)', boxShadow: '0 10px 35px rgba(245,87,108,.4)' }); })
      .on('click', function() {
        window.open('https://library.career-9.com', '_blank');
      });
  }
};
