// ─── DATA ─────────────────────────────────────────────────
const students = [
  {id:1,name:'Priya Singh',grade:'10A',type:'I-R',cci:'High',flag:false,initials:'PS'},
  {id:2,name:'Aarav Sharma',grade:'10A',type:'I-R-C',cci:'High',flag:false,initials:'AS'},
  {id:3,name:'Aryan Mehta',grade:'9A',type:'—',cci:'None',flag:true,initials:'AM'},
  {id:4,name:'Sneha Kapoor',grade:'9A',type:'S-A',cci:'Low',flag:true,initials:'SK'},
  {id:5,name:'Rahul Verma',grade:'9B',type:'R-I',cci:'Moderate',flag:false,initials:'RV'},
  {id:6,name:'Kabir Singh',grade:'9A',type:'I-E',cci:'Moderate',flag:true,initials:'KS'},
  {id:7,name:'Ananya Joshi',grade:'10B',type:'A-S',cci:'Moderate',flag:true,initials:'AJ'},
  {id:8,name:'Dev Patel',grade:'9A',type:'R-E',cci:'Moderate',flag:true,initials:'DP'},
  {id:9,name:'Riya Sharma',grade:'10A',type:'S-I',cci:'Moderate',flag:true,initials:'RS'},
  {id:10,name:'Mehul Shah',grade:'11S',type:'I-C',cci:'High',flag:false,initials:'MS'},
  {id:11,name:'Neha Gupta',grade:'11C',type:'C-E',cci:'High',flag:false,initials:'NG'},
  {id:12,name:'Vivaan Jain',grade:'11S',type:'I-R',cci:'High',flag:false,initials:'VJ'},
];

const clusters = [
  {type:'I',name:'Investigative',col:'#0D5C42',fill:'#10866A',pct:38,careers:'CS, Science, Research, Medicine'},
  {type:'R',name:'Realistic',col:'#1A3866',fill:'#2A5CB8',pct:27,careers:'Engineering, Architecture, Trades, Sports'},
  {type:'C',name:'Conventional',col:'#4B2088',fill:'#7B4FCF',pct:14,careers:'Finance, Banking, Administration, Law'},
  {type:'E',name:'Enterprising',col:'#B85C0D',fill:'#E07B25',pct:11,careers:'Management, Entrepreneurship, Sales'},
  {type:'S',name:'Social',col:'#0F5132',fill:'#198754',pct:7,careers:'Education, Healthcare, Counselling, HR'},
  {type:'A',name:'Artistic',col:'#8C1515',fill:'#C0392B',pct:3,careers:'Design, Media, Arts, Architecture'},
];

// ─── ROLE SWITCHING ──────────────────────────────────────
function switchRole(role, btn) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
  document.getElementById(`screen-${role}`).classList.add('active');
  btn.classList.add('active');
  if (role === 'counsellor') renderStudentList(students);
  setTimeout(animBars, 150);
}

// ─── FILL BARS ───────────────────────────────────────────
function animBars() {
  document.querySelectorAll('.ibf,.cr-fill,.mi-fill').forEach(b => {
    const w = b.style.width; b.style.width = '0';
    requestAnimationFrame(() => requestAnimationFrame(() => b.style.width = w));
  });
}
setTimeout(animBars, 300);

// ─── CLUSTER BARS ────────────────────────────────────────
function renderClusters() {
  const el = document.getElementById('clusterBars');
  el.innerHTML = clusters.map(c => `
    <div class="cluster-row">
      <div class="cr-type" style="background:${c.fill}">${c.type}</div>
      <div>
        <div class="cr-name">${c.name}</div>
        <div class="cr-careers">${c.careers}</div>
      </div>
      <div class="cr-bar-w"><div class="cr-bg"><div class="cr-fill" style="width:${c.pct}%;background:${c.fill}"></div></div></div>
      <div class="cr-pct" style="color:${c.fill}">${c.pct}%</div>
    </div>`).join('');
}
renderClusters();

// ─── STUDENT LIST ────────────────────────────────────────
function renderStudentList(list) {
  const el = document.getElementById('studentList');
  if (!el) return;
  el.innerHTML = list.map((s,i) => `
    <div class="sl-item ${s.flag?'flagged':''} ${i===0?'active':''}" onclick="selectStudent(this,${s.id})">
      <div class="sl-av" style="${s.flag?'background:linear-gradient(135deg,#C0392B,#E88080)':''}">${s.initials}</div>
      <div class="sl-info">
        <div class="sl-name">${s.name} ${s.flag?'<span style="color:var(--rm);font-size:10px">⚑</span>':''}</div>
        <div class="sl-grade">Gr ${s.grade} &nbsp;·&nbsp; ${s.type} &nbsp;·&nbsp; CCI: ${s.cci}</div>
      </div>
      <span class="pill ${s.cci==='High'?'p-hi':s.cci==='Low'||s.cci==='None'?'p-lo':'p-md'}" style="font-size:9px">${s.cci}</span>
    </div>`).join('');
}
renderStudentList(students);

function selectStudent(el, id) {
  document.querySelectorAll('.sl-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}

function filterStudents(q) {
  const filtered = students.filter(s => s.name.toLowerCase().includes(q.toLowerCase()) || s.grade.toLowerCase().includes(q.toLowerCase()));
  renderStudentList(filtered);
}

// ─── CLASS SELECT ────────────────────────────────────────
function selectClass(btn, cls) {
  document.querySelectorAll('.cs-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ─── SD TABS ────────────────────────────────────────────
function sdTab(el, tab) {
  document.querySelectorAll('.sdtab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

// ─── MODALS ──────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
  if (id === 'cciModal') drawCCIChart();
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); }));

// ─── CCI CHART ───────────────────────────────────────────
let cciChartInst;
function drawCCIChart() {
  if (cciChartInst) return;
  cciChartInst = new Chart(document.getElementById('cciChart'), {
    type: 'bar',
    data: {
      labels: ['Gr 6', 'Gr 7', 'Gr 8', 'Gr 9', 'Gr 10', 'Gr 11', 'Gr 12'],
      datasets: [
        { label: 'High CCI', data: [18, 22, 26, 29, 33, 36, 40], backgroundColor: '#10866A' },
        { label: 'Moderate', data: [30, 28, 26, 28, 29, 27, 28], backgroundColor: '#F9C57A' },
        { label: 'Low / None', data: [52, 50, 48, 43, 38, 37, 32], backgroundColor: '#E88080' },
      ]
    },
    options: {
      responsive: true, scales: { x: { stacked: true }, y: { stacked: true, max: 100, ticks: { callback: v => v + '%' } } },
      plugins: { legend: { position: 'bottom' } }
    }
  });
}
// Add PDF download button after DOM loads
const __navDashboardAddPdfBtn = () => {
  const banner = document.querySelector('.student-banner');
  if (banner && !document.getElementById('pdfBtn')) {
    const btn = document.createElement('button');
    btn.id = 'pdfBtn';
    btn.innerHTML = '⬇ Download PDF Report';
    btn.style.cssText = 'padding:8px 16px;background:#1DB88F;color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--sans);flex-shrink:0;margin-left:10px';
    btn.onclick = generatePDF;
    banner.appendChild(btn);
  }
};
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(__navDashboardAddPdfBtn, 0);
} else {
  document.addEventListener('DOMContentLoaded', __navDashboardAddPdfBtn);
}

function generatePDF() {
  // Switch to student view if not already there
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-student').classList.add('active');

  // Show all bars (ensure they're animated)
  document.querySelectorAll('.ibf,.cr-fill,.mi-fill').forEach(b => {
    if (b.style.width === '0px' || b.style.width === '') {
      const w = b.getAttribute('data-w') || b.style.width;
      b.style.width = w;
    }
  });

  // Small delay to ensure render, then print
  setTimeout(() => {
    window.print();
  }, 300);
}
