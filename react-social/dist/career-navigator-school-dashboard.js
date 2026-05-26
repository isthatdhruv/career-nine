// ══════════════ DATA ══════════════
const mockStudents=[
  {id:1,name:"Aarav Sharma",cls:"9A",grade:9,section:"A",personality:["Investigative","Realistic","Conventional"],intel:["Logical-Mathematical","Spatial-Visual","Intrapersonal"],abilities:["Logical reasoning","Computational","Form perception"],weakAbility:"Communication",cci:"High",redFlag:false,notes:[]},
  {id:2,name:"Priya Menon",cls:"9A",grade:9,section:"A",personality:["Artistic","Social","Investigative"],intel:["Linguistic","Interpersonal","Musical"],abilities:["Communication","Creativity","Language"],weakAbility:"Technical",cci:"High",redFlag:false,notes:[]},
  {id:3,name:"Rohan Patil",cls:"9A",grade:9,section:"A",personality:["Realistic","Conventional","Enterprising"],intel:["Bodily-Kinesthetic","Logical-Mathematical","Naturalistic"],abilities:["Technical","Motor movement","Form perception"],weakAbility:"Creativity",cci:"Moderate",redFlag:false,notes:[]},
  {id:4,name:"Sneha Joshi",cls:"9A",grade:9,section:"A",personality:["Social","Conventional","Realistic"],intel:["Interpersonal","Intrapersonal","Linguistic"],abilities:["Communication","Decision making","Language"],weakAbility:"Technical",cci:"Moderate",redFlag:false,notes:[]},
  {id:5,name:"Karan Desai",cls:"9A",grade:9,section:"A",personality:["Conventional","Realistic","Investigative"],intel:["Logical-Mathematical","Spatial-Visual","Naturalistic"],abilities:["Computational","Speed and accuracy","Form perception"],weakAbility:"Communication",cci:"Moderate",redFlag:false,notes:[]},
  {id:6,name:"Meera Nair",cls:"9B",grade:9,section:"B",personality:["Artistic","Investigative","Social"],intel:["Musical","Spatial-Visual","Linguistic"],abilities:["Creativity","Communication","Language"],weakAbility:"Computational",cci:"High",redFlag:false,notes:[]},
  {id:7,name:"Arjun Singh",cls:"9B",grade:9,section:"B",personality:["Enterprising","Conventional","Social"],intel:["Interpersonal","Logical-Mathematical","Intrapersonal"],abilities:["Decision making","Communication","Speed and accuracy"],weakAbility:"Creativity",cci:"High",redFlag:false,notes:[]},
  {id:8,name:"Divya Sharma",cls:"9B",grade:9,section:"B",personality:["Social","Artistic","Enterprising"],intel:["Interpersonal","Linguistic","Musical"],abilities:["Communication","Language","Creativity"],weakAbility:"Computational",cci:"Low",redFlag:true,notes:["Aspiration matches suitability but student unsure. Need 2 more sessions."]},
  {id:9,name:"Vikram Rao",cls:"9B",grade:9,section:"B",personality:["Realistic","Investigative","Conventional"],intel:["Spatial-Visual","Logical-Mathematical","Bodily-Kinesthetic"],abilities:["Technical","Form perception","Logical reasoning"],weakAbility:"Communication",cci:"Moderate",redFlag:false,notes:[]},
  {id:10,name:"Ananya Pillai",cls:"9B",grade:9,section:"B",personality:["Investigative","Artistic","Social"],intel:["Naturalistic","Spatial-Visual","Logical-Mathematical"],abilities:["Logical reasoning","Creativity","Form perception"],weakAbility:"Technical",cci:"High",redFlag:false,notes:[]},
  {id:11,name:"Rahul Kumar",cls:"10A",grade:10,section:"A",personality:["Conventional","Realistic","Investigative"],intel:["Logical-Mathematical","Intrapersonal","Spatial-Visual"],abilities:["Computational","Speed and accuracy","Logical reasoning"],weakAbility:"Motor movement",cci:"High",redFlag:false,notes:[]},
  {id:12,name:"Pooja Iyer",cls:"10A",grade:10,section:"A",personality:["Social","Artistic","Investigative"],intel:["Linguistic","Interpersonal","Musical"],abilities:["Communication","Language","Creativity"],weakAbility:"Technical",cci:"Moderate",redFlag:false,notes:["Interested in journalism – explore IIMC, Symbiosis."]},
  {id:13,name:"Amit Verma",cls:"10A",grade:10,section:"A",personality:["Realistic","Enterprising","Conventional"],intel:["Bodily-Kinesthetic","Logical-Mathematical","Spatial-Visual"],abilities:["Technical","Motor movement","Form perception"],weakAbility:"Creativity",cci:"Low",redFlag:true,notes:[]},
  {id:14,name:"Riya Patel",cls:"10A",grade:10,section:"A",personality:["Investigative","Artistic","Realistic"],intel:["Logical-Mathematical","Spatial-Visual","Naturalistic"],abilities:["Logical reasoning","Creativity","Computational"],weakAbility:"Motor movement",cci:"High",redFlag:false,notes:[]},
  {id:15,name:"Siddharth More",cls:"10A",grade:10,section:"A",personality:["Enterprising","Social","Conventional"],intel:["Interpersonal","Logical-Mathematical","Linguistic"],abilities:["Decision making","Communication","Speed and accuracy"],weakAbility:"Finger dexterity",cci:"Moderate",redFlag:false,notes:[]},
  {id:16,name:"Kavita Reddy",cls:"10B",grade:10,section:"B",personality:["Social","Investigative","Artistic"],intel:["Interpersonal","Naturalistic","Linguistic"],abilities:["Communication","Decision making","Language"],weakAbility:"Computational",cci:"High",redFlag:false,notes:["Would excel in psychology – guide toward BA Psych path."]},
  {id:17,name:"Nikhil Bhosle",cls:"10B",grade:10,section:"B",personality:["Realistic","Conventional","Enterprising"],intel:["Spatial-Visual","Bodily-Kinesthetic","Logical-Mathematical"],abilities:["Technical","Form perception","Speed and accuracy"],weakAbility:"Communication",cci:"Moderate",redFlag:false,notes:[]},
  {id:18,name:"Shruti Kulkarni",cls:"10B",grade:10,section:"B",personality:["Artistic","Social","Investigative"],intel:["Musical","Linguistic","Interpersonal"],abilities:["Creativity","Communication","Language"],weakAbility:"Computational",cci:"Low",redFlag:true,notes:[]},
  {id:19,name:"Tushar Shah",cls:"11A",grade:11,section:"A",personality:["Conventional","Investigative","Realistic"],intel:["Logical-Mathematical","Intrapersonal","Spatial-Visual"],abilities:["Computational","Logical reasoning","Speed and accuracy"],weakAbility:"Communication",cci:"High",redFlag:false,notes:[]},
  {id:20,name:"Nisha Goswami",cls:"11A",grade:11,section:"A",personality:["Social","Enterprising","Conventional"],intel:["Interpersonal","Linguistic","Intrapersonal"],abilities:["Communication","Decision making","Language"],weakAbility:"Technical",cci:"Moderate",redFlag:false,notes:[]},
  {id:21,name:"Deepak Malhotra",cls:"11A",grade:11,section:"A",personality:["Realistic","Investigative","Conventional"],intel:["Logical-Mathematical","Spatial-Visual","Bodily-Kinesthetic"],abilities:["Technical","Logical reasoning","Form perception"],weakAbility:"Communication",cci:"High",redFlag:false,notes:[]},
  {id:22,name:"Anjali Tiwari",cls:"11A",grade:11,section:"A",personality:["Artistic","Investigative","Social"],intel:["Linguistic","Musical","Intrapersonal"],abilities:["Creativity","Language","Communication"],weakAbility:"Computational",cci:"Low",redFlag:true,notes:["Low CCI – aspiring journalism but matched to Art Design. Explore mass comm."]},
  {id:23,name:"Suresh Patil",cls:"11S",grade:11,section:"S",personality:["Investigative","Realistic","Conventional"],intel:["Logical-Mathematical","Naturalistic","Spatial-Visual"],abilities:["Logical reasoning","Computational","Technical"],weakAbility:"Communication",cci:"High",redFlag:false,notes:[]},
  {id:24,name:"Prachi Jain",cls:"11S",grade:11,section:"S",personality:["Investigative","Social","Artistic"],intel:["Naturalistic","Interpersonal","Linguistic"],abilities:["Decision making","Communication","Creativity"],weakAbility:"Technical",cci:"High",redFlag:false,notes:[]},
];

const personalityAdjectives={
  Realistic:["Practical","Hands-on","Athletic","Mechanical","Stable","Persistent","Frank","Modest"],
  Investigative:["Analytical","Intellectual","Curious","Precise","Independent","Reserved","Complex","Observant"],
  Artistic:["Creative","Imaginative","Expressive","Sensitive","Open","Flexible","Intuitive","Idealistic"],
  Social:["Helpful","Empathetic","Cooperative","Patient","Friendly","Generous","Idealistic","Responsible"],
  Enterprising:["Ambitious","Energetic","Adventurous","Persuasive","Assertive","Confident","Goal-oriented","Risk-taking"],
  Conventional:["Organized","Detail-oriented","Accurate","Systematic","Reliable","Careful","Efficient","Consistent"],
};
const personalityGuidelines={
  Realistic:{career:"Engineering, Agriculture, Vocational, Sports, Defence",workshops:["Robotics & Maker Labs","Workshop visits to factories","Sports & fitness programs","Farm/environment trips"],low:"Low Realistic can be improved through hands-on lab projects, craft workshops, and physical education programs."},
  Investigative:{career:"Research, Science, Medicine, Data Science, CS",workshops:["Science fair & research clubs","Coding bootcamps","Debate & questioning sessions","Math olympiad preparation"],low:"Low Investigative can be improved through curiosity challenges, 'why does this work?' classroom activities, and science documentaries."},
  Artistic:{career:"Design, Media, Entertainment, Architecture, Arts",workshops:["Art & design exhibitions","Drama & theater club","Creative writing workshops","Music & dance performances"],low:"Low Artistic can be lifted through visual storytelling projects, school magazine design, and cultural fest organization."},
  Social:{career:"Education, Healthcare, Social Work, Counselling, HR",workshops:["Peer mentoring programs","Community service activities","Communication skill workshops","Role-play in real-world scenarios"],low:"Low Social can be developed through group projects, buddy system between seniors and juniors, and community outreach."},
  Enterprising:{career:"Management, Entrepreneurship, Law, Marketing, Politics",workshops:["Mini business challenge","Mock elections & debates","Leadership bootcamps","Sales & negotiation simulations"],low:"Low Enterprising can be boosted by assigning leadership roles, running school events, and entrepreneurship competitions."},
  Conventional:{career:"Banking, Finance, Law, Government, Accounting",workshops:["Finance literacy sessions","Filing & record-keeping tasks","Data entry and spreadsheet challenges","Time management workshops"],low:"Low Conventional can be improved through structured daily planners, habit trackers, and organized project management tasks."},
};
const learningStyleData=[
  {name:"Logical-Mathematical",g68:74,g910:78,g1112:72,trend:"stable",desc:"Learns through numbers, patterns, experiments",tip:"Use data projects, puzzles, and scientific method activities"},
  {name:"Interpersonal",g68:68,g910:62,g1112:55,trend:"down",desc:"Learns through discussing and working with others",tip:"Group projects, peer teaching, collaborative assignments"},
  {name:"Linguistic",g68:71,g910:61,g1112:58,trend:"down",desc:"Learns through reading, writing, storytelling",tip:"Essays, debates, school magazine – invest urgently"},
  {name:"Spatial-Visual",g68:66,g910:70,g1112:68,trend:"stable",desc:"Learns through images, maps, visualization",tip:"Mind maps, diagrams, flowcharts, video content"},
  {name:"Bodily-Kinesthetic",g68:72,g910:65,g1112:60,trend:"down",desc:"Learns through movement and hands-on activities",tip:"Lab experiments, role plays, craft, sports"},
  {name:"Intrapersonal",g68:65,g910:69,g1112:74,trend:"up",desc:"Learns through self-reflection and self-pacing",tip:"Journaling, goal-setting, independent research projects"},
  {name:"Musical",g68:58,g910:52,g1112:48,trend:"down",desc:"Learns through rhythms and patterns in sound",tip:"Use music in mnemonics, rhythm-based activities, school band"},
  {name:"Naturalistic",g68:70,g910:66,g1112:63,trend:"stable",desc:"Learns through nature, classification, environment",tip:"Outdoor education, ecology projects, field trips"},
];
const aspirationGapData=[
  {career:"Engineering",g68_asp:55,g68_suit:48,g910_asp:70,g910_suit:52,g1112_asp:75,g1112_suit:45,activities:["Robotics club","STEM fair","Industry visits to factories","Coding bootcamps"],extracurr:"Science quiz, maths olympiad, maker labs"},
  {career:"Science/Math",g68_asp:60,g68_suit:62,g910_asp:58,g910_suit:65,g1112_asp:50,g1112_suit:60,activities:["Science fair","Research projects","Nature study","Astronomy club"],extracurr:"Science Olympiad, eco-club, NASA challenge"},
  {career:"Computer Sci.",g68_asp:35,g68_suit:50,g910_asp:45,g910_suit:55,g1112_asp:55,g1112_suit:52,activities:["Coding clubs","App development challenge","Digital literacy sessions"],extracurr:"Hackathon, AI workshop, coding competition"},
  {career:"Medicine",g68_asp:42,g68_suit:44,g910_asp:40,g910_suit:45,g1112_asp:38,g1112_suit:50,activities:["First aid training","Biology lab","Hospital visit","Health awareness drive"],extracurr:"Red Cross, health quiz, biology olympiad"},
  {career:"Commerce/Finance",g68_asp:20,g68_suit:35,g910_asp:32,g910_suit:45,g1112_asp:40,g1112_suit:50,activities:["Finance literacy workshop","Mock stock market","Budget simulation"],extracurr:"Economics olympiad, junior CA club, finance quiz"},
  {career:"Creative Arts",g68_asp:30,g68_suit:42,g910_asp:22,g910_suit:38,g1112_asp:18,g1112_suit:35,activities:["Art exhibitions","Performing arts festival","Design workshop"],extracurr:"Art competition, cultural fest, photography club"},
  {career:"Social Service",g68_asp:22,g68_suit:32,g910_asp:20,g910_suit:35,g1112_asp:22,g1112_suit:38,activities:["Community service","NGO visits","Awareness campaigns"],extracurr:"NSS, eco drives, peer counselling program"},
];

// Section comparison data
const sectionCompData={
  "9":{sections:["9A","9B"],cci:{high:[42,50],mod:[33,30],low:[25,20]},avgAbility:[62,68],avgLS:[70,65]},
  "10":{sections:["10A","10B"],cci:{high:[40,45],mod:[36,30],low:[24,25]},avgAbility:[65,60],avgLS:[68,72]},
  "11":{sections:["11A","11S"],cci:{high:[45,60],mod:[30,28],low:[25,12]},avgAbility:[68,75],avgLS:[65,78]},
};

// Messages system
let messages=[
  {id:1,from:"principal",fromLabel:"Principal",student:null,body:"Please check on Grade 9B – Divya Sharma. Low CCI and seems disengaged. Schedule a session this week.",time:"Today 9:12am",read:false,replies:[]},
  {id:2,from:"teacher9A",fromLabel:"Teacher – Grade 9A",student:"Aarav Sharma",body:"Aarav is doing very well in Science but struggles with communication tasks. Can we get his counsellor report?",time:"Yesterday 4:05pm",read:false,replies:[]},
  {id:3,from:"teacher10A",fromLabel:"Teacher – Grade 10A",student:"Amit Verma",body:"Amit Verma (10A) has red flag – CCI is Low and seems uninterested in class. His sports ability is very strong. Can counsellor guide him toward sports/defence career?",time:"Yesterday 2:30pm",read:false,replies:[]},
];
let teacherNotes=[];
let sessionNotes={};
mockStudents.forEach(s=>{ sessionNotes[s.id]=[...s.notes]; });
let selectedStudentId=null,cciFilter='all',currentGradeFilter='all',currentSectionFilter='all',currentPersonFilter='all';
let cPersonChartI=null,cCCIChartI=null,teacherIntelI=null,teacherAbilI=null;

// ══════════════ NAVIGATION ══════════════
function switchRole(role,btn){
  document.querySelectorAll('.dash').forEach(d=>d.classList.remove('active'));
  document.querySelectorAll('.rbtn').forEach(b=>b.classList.remove('active'));
  document.getElementById('dash-'+role).classList.add('active');
  btn.classList.add('active');
  if(role==='counsellor'){renderStudentList();renderCounsellorAggr();renderMessages();initCalendar();}
  if(role==='teacher')updateTeacherDash();
}

// ══════════════ MODAL ══════════════
function openModal(id){
  const m=document.getElementById('modal-'+id);
  if(!m)return;
  m.classList.add('open');
  if(id==='kpiStudents')buildKPIStudents();
  else if(id==='kpiCompletion')buildKPICompletion();
  else if(id==='kpiCCI')buildKPICCI();
  else if(id==='kpiSupport')buildKPISupport();
  else if(id==='personalityDrill')buildPersonalityDrill();
  else if(id==='aspirationDrill')buildAspirationDrill();
  else if(id==='learningStylesDrill')buildLSDrill();
}
function closeModal(id){document.getElementById('modal-'+id).classList.remove('open');}
document.addEventListener('click',e=>{if(e.target.classList.contains('modal-bg'))e.target.classList.remove('open');});

// ══════════════ PRINCIPAL CHARTS ══════════════
const __schoolDashboardInit = ()=>{
  renderPersonalityChart();
  renderLSHeatmap();
  renderCCIChart();
  renderGapChart();
  updateTeacherDash();
  renderStudentList();
  renderCounsellorAggr();
  renderMessages();
  renderStudentRadar();
  updateNotifCount();
  initCalendar();
  // Populate student appointment slots
  const slots = ['Mon 13 Jan · 10:00 AM','Tue 14 Jan · 11:30 AM','Thu 16 Jan · 3:00 PM'];
  const slotsEl = document.getElementById('studentApptSlots');
  if(slotsEl) slotsEl.innerHTML = slots.map(sl => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:11px;color:var(--text)">${sl}</span>
      <button class="btn btn-sm" style="font-size:10px;padding:2px 8px" onclick="selectStudentSlot(this,'${sl}')">Select</button>
    </div>`).join('');
};
if(document.readyState==='complete'||document.readyState==='interactive'){
  setTimeout(__schoolDashboardInit,0);
} else {
  window.addEventListener('load',__schoolDashboardInit);
}

function renderPersonalityChart(){
  const ctx=document.getElementById('personalityChart');
  const labels=['Realistic','Investigative','Artistic','Social','Enterprising','Conventional'];
  new Chart(ctx,{
    type:'radar',
    data:{
      labels,
      datasets:[
        {label:'Gr 6–8',data:[62,58,70,65,55,60],borderColor:'#0C6B5A',backgroundColor:'rgba(12,107,90,0.1)',pointBackgroundColor:'#0C6B5A',borderWidth:2,pointRadius:3},
        {label:'Gr 9–10',data:[70,65,55,60,62,68],borderColor:'#36B37E',backgroundColor:'rgba(54,179,126,0.08)',pointBackgroundColor:'#36B37E',borderWidth:2,pointRadius:3},
        {label:'Gr 11–12',data:[75,68,45,55,65,72],borderColor:'#F59E0B',backgroundColor:'rgba(245,158,11,0.08)',pointBackgroundColor:'#F59E0B',borderWidth:2,pointRadius:3},
      ]
    },
    options:{
      responsive:true,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>{const p=labels[ctx.dataIndex];const adj=personalityAdjectives[p]||[];return[`${ctx.dataset.label}: ${ctx.raw}%`,...adj.slice(0,3).map(a=>'  • '+a)];}}}},
      scales:{r:{min:30,max:80,ticks:{display:false},grid:{color:'#E5E7EB'},pointLabels:{font:{size:10}}}}
    }
  });
}

function renderLSHeatmap(){
  const colorFor=v=>v>=70?'#D1FAE5':v>=60?'#FEF3C7':'#FEE2E2';
  const txtFor=v=>v>=70?'#065F46':v>=60?'#92400E':'#991B1B';
  const trendIcon=t=>t==='up'?'↑':t==='down'?'↓':'—';
  const trendCol=t=>t==='up'?'#059669':t==='down'?'#DC2626':'#6B7280';
  const tb=document.getElementById('lsHeatmap');
  learningStyleData.forEach(r=>{
    const tr=document.createElement('tr');
    tr.style.cursor='pointer';
    tr.onclick=()=>openModal('learningStylesDrill');
    tr.innerHTML=`<td style="font-size:11px">${r.name}</td>
      <td><span style="background:${colorFor(r.g68)};color:${txtFor(r.g68)};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${r.g68}%</span></td>
      <td><span style="background:${colorFor(r.g910)};color:${txtFor(r.g910)};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${r.g910}%</span></td>
      <td><span style="background:${colorFor(r.g1112)};color:${txtFor(r.g1112)};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${r.g1112}%</span></td>
      <td><span style="color:${trendCol(r.trend)};font-weight:700">${trendIcon(r.trend)}</span></td>`;
    tb.appendChild(tr);
  });
}

function renderCCIChart(){
  const cciGradeData={
    "Grade 6":{High:45,Mod:35,Low:20},
    "Grade 7":{High:44,Mod:36,Low:20},
    "Grade 8":{High:40,Mod:34,Low:26},
    "Grade 9":{High:38,Mod:40,Low:22},
    "Grade 10":{High:33,Mod:40,Low:27},
    "Grade 11":{High:22,Mod:33,Low:45},
    "Grade 12":{High:18,Mod:37,Low:45},
  };
  const labels=Object.keys(cciGradeData);
  const c=new Chart(document.getElementById('cciChart'),{
    type:'bar',
    data:{labels,datasets:[
      {label:'High',data:labels.map(l=>cciGradeData[l].High),backgroundColor:'#059669',stack:'s'},
      {label:'Moderate',data:labels.map(l=>cciGradeData[l].Mod),backgroundColor:'#D97706',stack:'s'},
      {label:'Low/None',data:labels.map(l=>cciGradeData[l].Low),backgroundColor:'#DC2626',stack:'s'},
    ]},
    options:{
      responsive:true,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{afterBody:(items)=>{
          const idx=items[0].dataIndex;
          const grp=labels[idx];
          const d=cciGradeData[grp];
          return[`High: ${d.High}%`,`Moderate: ${d.Mod}%`,`Low/None: ${d.Low}%`];
        }}}
      },
      onHover:(e,els)=>{
        const panel=document.getElementById('cciHoverPanel');
        if(els.length){
          const idx=els[0].index;
          const grp=labels[idx];const d=cciGradeData[grp];
          panel.style.display='block';
          panel.innerHTML=`<strong>${grp} Breakdown</strong>: High <span style="color:#059669;font-weight:700">${d.High}%</span> · Moderate <span style="color:#D97706;font-weight:700">${d.Mod}%</span> · Low/None <span style="color:#DC2626;font-weight:700">${d.Low}%</span>`;
        } else panel.style.display='none';
      },
      scales:{x:{stacked:true,grid:{display:false},ticks:{font:{size:10}}},y:{stacked:true,max:100,ticks:{callback:v=>v+'%'},grid:{color:'#E5E7EB'}}}
    }
  });
}

function renderGapChart(){
  const careerLabels=aspirationGapData.map(d=>d.career);
  const asp=aspirationGapData.map(d=>Math.round((d.g68_asp+d.g910_asp+d.g1112_asp)/3));
  const suit=aspirationGapData.map(d=>Math.round((d.g68_suit+d.g910_suit+d.g1112_suit)/3));
  new Chart(document.getElementById('gapChart'),{
    type:'bar',
    data:{labels:careerLabels,datasets:[
      {label:'Aspiration %',data:asp,backgroundColor:'#0C6B5A99',borderColor:'#0C6B5A',borderWidth:1},
      {label:'Suitability %',data:suit,backgroundColor:'#F59E0B88',borderColor:'#D97706',borderWidth:1},
    ]},
    options:{responsive:true,indexAxis:'y',plugins:{legend:{position:'top',labels:{boxWidth:9,font:{size:10}}}},
      scales:{x:{max:80,ticks:{callback:v=>v+'%'},grid:{color:'#E5E7EB'}},y:{grid:{display:false},ticks:{font:{size:11}}}}}
  });
}

// ══════════════ MODAL BUILDERS ══════════════
function buildKPIStudents(){
  const grades=[6,7,8,9,10,11,12];
  const counts=[42,48,55,85,78,89,90];
  const grid=document.getElementById('kpiStudentsGrid');
  grid.innerHTML=grades.map((g,i)=>`<div class="grade-comp-card">
    <div class="grade-comp-grade">Grade ${g}</div>
    <div class="grade-comp-val">${counts[i]}</div>
    <div class="grade-comp-bar"><div class="pb"><div class="pf" style="width:${counts[i]/90*100}%;background:var(--p)"></div></div></div>
  </div>`).join('');
  new Chart(document.getElementById('kpiStudentsChart'),{
    type:'bar',
    data:{labels:grades.map(g=>'Gr '+g),datasets:[{label:'Students Assessed',data:counts,backgroundColor:'#0C6B5A',borderRadius:4}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{grid:{color:'#E5E7EB'}}}}
  });
}

function buildKPICompletion(){
  const rows=[
    {grade:6,section:"A",total:22,completed:21,pct:95},
    {grade:7,section:"A",total:24,completed:23,pct:96},
    {grade:8,section:"A",total:28,completed:25,pct:89},
    {grade:9,section:"A",total:42,completed:30,pct:71},
    {grade:9,section:"B",total:43,completed:32,pct:74},
    {grade:10,section:"A",total:38,completed:27,pct:71},
    {grade:10,section:"B",total:40,completed:29,pct:73},
    {grade:11,section:"A",total:45,completed:38,pct:84},
    {grade:11,section:"S",total:44,completed:41,pct:93},
    {grade:12,section:"A",total:90,completed:70,pct:78},
  ];
  const tb=document.getElementById('completionTable');
  tb.innerHTML=rows.map(r=>{
    const isBad=r.pct<90;
    const badStyle=isBad?'background:#FEF2F2':'' ;
    return`<tr style="${badStyle}">
      <td>Grade ${r.grade}</td><td>Section ${r.section}</td><td>${r.total}</td><td>${r.completed}</td>
      <td><span style="font-weight:700;color:${isBad?'#DC2626':'#059669'}">${r.pct}% ${isBad?'⚠':''}</span></td>
      <td style="color:${isBad?'#DC2626':'#6B7280'};font-weight:${isBad?'700':'400'}">${r.total-r.completed} missing</td>
      <td><span class="badge ${isBad?'bl':'bh'}">${isBad?'Below Target':'On Track'}</span></td>
    </tr>`;
  }).join('');
}

function buildKPICCI(){
  const grades=[6,7,8,9,10,11,12];
  const highPct=[45,44,40,38,33,22,18];
  const grid=document.getElementById('kpiCCIGrid');
  grid.innerHTML=grades.map((g,i)=>`<div class="grade-comp-card">
    <div class="grade-comp-grade">Grade ${g}</div>
    <div class="grade-comp-val" style="color:${highPct[i]>=40?'var(--s)':highPct[i]>=25?'var(--acc)':'var(--danger)'}">${highPct[i]}%</div>
    <div style="font-size:9px;color:var(--muted)">High CCI</div>
    <div class="grade-comp-bar" style="margin-top:4px"><div class="pb"><div class="pf" style="width:${highPct[i]}%;background:${highPct[i]>=40?'var(--s)':highPct[i]>=25?'var(--acc)':'var(--danger)'}"></div></div></div>
  </div>`).join('');
  new Chart(document.getElementById('kpiCCIChart'),{
    type:'line',
    data:{labels:grades.map(g=>'Gr '+g),datasets:[{label:'High CCI %',data:highPct,borderColor:'#0C6B5A',backgroundColor:'rgba(12,107,90,0.1)',tension:.35,fill:true,pointBackgroundColor:'#0C6B5A'}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{max:60,ticks:{callback:v=>v+'%'},grid:{color:'#E5E7EB'}}}}
  });
}

function buildKPISupport(){
  const grades=[6,7,8,9,10,11,12];
  const pct=[10,12,18,26,28,38,45];
  const grid=document.getElementById('kpiSupportGrid');
  grid.innerHTML=grades.map((g,i)=>`<div class="grade-comp-card">
    <div class="grade-comp-grade">Grade ${g}</div>
    <div class="grade-comp-val" style="color:${pct[i]>=30?'var(--danger)':pct[i]>=20?'var(--acc)':'var(--s)'}">${pct[i]}%</div>
    <div style="font-size:9px;color:var(--muted)">needing support</div>
    <div class="grade-comp-bar" style="margin-top:4px"><div class="pb"><div class="pf" style="width:${pct[i]/50*100}%;background:${pct[i]>=30?'var(--danger)':pct[i]>=20?'var(--acc)':'var(--s)'}"></div></div></div>
  </div>`).join('');
  const tb=document.getElementById('kpiSupportTable');
  const lowStudents=mockStudents.filter(s=>s.cci==='Low'||s.redFlag);
  tb.innerHTML=lowStudents.map(s=>`<tr>
    <td style="font-weight:500">${s.name}</td>
    <td>${s.grade}</td><td>${s.cls}</td>
    <td><span class="badge bl">${s.cci}</span></td>
    <td style="font-size:11px;color:var(--acc)">${s.weakAbility}</td>
  </tr>`).join('');
}

function buildPersonalityDrill(){
  const types=['Realistic','Investigative','Artistic','Social','Enterprising','Conventional'];
  const schoolCounts={Realistic:34,Investigative:28,Artistic:19,Social:15,Enterprising:14,Conventional:32};
  const body=document.getElementById('personalityDrillBody');
  body.innerHTML=types.map(t=>{
    const g=personalityGuidelines[t];
    const adj=personalityAdjectives[t];
    const count=schoolCounts[t];
    const pct=Math.round(count/142*100);
    return`<div style="border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--pd)">${t} Type</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${pct}% of school (${count} students)</div>
        </div>
        <button onclick="flagToAllCounsellors('${t}')" class="btn btn-danger btn-sm">🚩 Raise Flag to Counsellor</button>
      </div>
      <div style="margin-bottom:8px"><strong style="font-size:11px;text-transform:uppercase;color:var(--muted)">Adjectives:</strong>
        <span style="font-size:12px;margin-left:6px">${adj.join(' · ')}</span></div>
      <div style="margin-bottom:8px"><strong style="font-size:11px;text-transform:uppercase;color:var(--muted)">Career Paths:</strong>
        <span style="font-size:12px;margin-left:6px;color:var(--pd)">${g.career}</span></div>
      <div style="margin-bottom:8px"><strong style="font-size:11px;text-transform:uppercase;color:var(--muted)">Recommended Workshops:</strong>
        <div style="margin-top:5px;display:flex;gap:5px;flex-wrap:wrap">${g.workshops.map(w=>`<span class="badge bt">${w}</span>`).join('')}</div>
      </div>
      <div class="insight"><span>📌</span><span>${g.low}</span></div>
    </div>`;
  }).join('');
}

function flagToAllCounsellors(type){
  messages.unshift({id:Date.now(),from:"principal",fromLabel:"Principal (Auto-flag)",student:null,body:`School-wide flag: ${type} personality type students need workshop attention. Percentage below expected. Please plan targeted sessions.`,time:"Just now",read:false,replies:[]});
  updateNotifCount();
  closeModal('personalityDrill');
  alert(`Flag sent to Counsellor regarding ${type} personality students.`);
}

function buildLSDrill(){
  const body=document.getElementById('lsDrillBody');
  body.innerHTML=`<div class="insight" style="margin-bottom:14px"><span>ℹ</span><span>Based on Howard Gardner's Theory of Multiple Intelligences. Each style represents how students learn best — not a fixed ability but a preference and strength.</span></div>`+
  learningStyleData.map(r=>`<div style="border:1px solid var(--border);border-radius:var(--rs);padding:12px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <div style="font-weight:600;font-size:13px;color:var(--pd)">${r.name}</div>
      <div style="display:flex;gap:6px">
        <span class="badge bt">Gr 6–8: ${r.g68}%</span>
        <span class="badge bb">Gr 9–10: ${r.g910}%</span>
        <span class="badge bp">Gr 11–12: ${r.g1112}%</span>
      </div>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:5px">${r.desc}</div>
    <div style="font-size:11px;color:var(--pd);font-weight:500">📌 ${r.tip}</div>
  </div>`).join('');
}

function buildAspirationDrill(){
  const body=document.getElementById('aspirationDrillBody');
  // QR placeholder using canvas
  const qrHtml=`<div class="qr-box" style="margin-top:14px">
    <div style="font-size:12px;font-weight:600;margin-bottom:6px">📚 Career Library QR</div>
    <div class="qr-code"><svg width="80" height="80" viewBox="0 0 80 80">
      <rect x="5" y="5" width="28" height="28" fill="none" stroke="#084A3E" stroke-width="4" rx="2"/>
      <rect x="12" y="12" width="14" height="14" fill="#084A3E" rx="1"/>
      <rect x="47" y="5" width="28" height="28" fill="none" stroke="#084A3E" stroke-width="4" rx="2"/>
      <rect x="54" y="12" width="14" height="14" fill="#084A3E" rx="1"/>
      <rect x="5" y="47" width="28" height="28" fill="none" stroke="#084A3E" stroke-width="4" rx="2"/>
      <rect x="12" y="54" width="14" height="14" fill="#084A3E" rx="1"/>
      <rect x="47" y="47" width="8" height="8" fill="#084A3E" rx="1"/>
      <rect x="58" y="47" width="8" height="8" fill="#084A3E" rx="1"/>
      <rect x="47" y="58" width="8" height="8" fill="#084A3E" rx="1"/>
      <rect x="58" y="58" width="17" height="8" fill="#084A3E" rx="1"/>
    </svg></div>
    <div style="font-size:10px;opacity:.8">Scan to access Career-9.com Library</div>
  </div>`;

  body.innerHTML=`<div class="insight" style="margin-bottom:14px"><span>💡</span><span>Use this data to plan extracurricular activities that bridge the aspiration–suitability gap by grade. Click any career for details.</span></div>`+
  aspirationGapData.map(d=>{
    const gap68=d.g68_asp-d.g68_suit;
    const gap910=d.g910_asp-d.g910_suit;
    const gap1112=d.g1112_asp-d.g1112_suit;
    const worstGap=Math.max(gap68,gap910,gap1112);
    const badgeClass=worstGap>15?'bl':worstGap>5?'bm':'bh';
    return`<div style="border:1px solid var(--border);border-radius:var(--rs);padding:12px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:13px;font-weight:600;color:var(--pd)">${d.career}</div>
        <span class="badge ${badgeClass}">${worstGap>0?'Gap: +'+worstGap+'% aspiration':'Balanced'}</span>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:8px;font-size:11px">
        <div><strong>Gr 6–8:</strong> Asp ${d.g68_asp}% / Suit ${d.g68_suit}% <span style="color:${d.g68_asp>d.g68_suit?'#DC2626':'#059669'}">(${d.g68_asp>d.g68_suit?'+':''}${d.g68_asp-d.g68_suit}%)</span></div>
        <div><strong>Gr 9–10:</strong> Asp ${d.g910_asp}% / Suit ${d.g910_suit}% <span style="color:${d.g910_asp>d.g910_suit?'#DC2626':'#059669'}">(${d.g910_asp>d.g910_suit?'+':''}${d.g910_asp-d.g910_suit}%)</span></div>
        <div><strong>Gr 11–12:</strong> Asp ${d.g1112_asp}% / Suit ${d.g1112_suit}% <span style="color:${d.g1112_asp>d.g1112_suit?'#DC2626':'#059669'}">(${d.g1112_asp>d.g1112_suit?'+':''}${d.g1112_asp-d.g1112_suit}%)</span></div>
      </div>
      <div style="margin-bottom:5px"><strong style="font-size:10px;text-transform:uppercase;color:var(--muted)">Extracurricular Activities:</strong></div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:5px">${d.activities.map(a=>`<span class="badge bt">${a}</span>`).join('')}</div>
      <div style="font-size:11px;color:var(--muted)">${d.extracurr}</div>
    </div>`;
  }).join('')+qrHtml;
}

// ══════════════ TEACHER ══════════════
const classStrategies={
  "9A":[{i:"🤖",t:"Logic Challenges",d:"Puzzles & coding for Investigative-dominant class"},{i:"🌿",t:"Nature Projects",d:"Naturalistic strength – outdoor science observation"},{i:"📝",t:"Structured Debates",d:"Build Linguistic + Communication ability"},{i:"🏗",t:"Mini Build Projects",d:"Realistic students learn through making"}],
  "9B":[{i:"🎵",t:"Creative Expression",d:"Artistic class – integrate art, music, drama"},{i:"🗣",t:"Team Presentations",d:"Interpersonal strength – collaborative projects"},{i:"📰",t:"Current Affairs",d:"Social + Enterprising – real-world problems"},{i:"💼",t:"Entrepreneurship Lab",d:"Mini-business simulation for E-types"}],
  "10A":[{i:"📊",t:"Data Analysis Tasks",d:"Conventional + Logical-Math – structured analysis"},{i:"✍",t:"Essay Writing",d:"Build Communication – key class gap"},{i:"⏱",t:"Mock Test Sessions",d:"Speed & Accuracy weak – timed practice"},{i:"🎤",t:"Career Panel",d:"Invite professionals for interactive Q&A"}],
  "10B":[{i:"🎨",t:"Design Thinking",d:"Artistic + weak Technical – bridge via design"},{i:"💬",t:"Communication Training",d:"Technical students need comm skills – ToastMasters"},{i:"🔬",t:"STEM + Art Fusion",d:"Realistic + Artistic combined exhibitions"},{i:"📔",t:"Reflection Journals",d:"Growing Intrapersonal – guided journaling"}],
  "11A":[{i:"📈",t:"Exam Readiness",d:"Analytical types – JEE/NEET structured prep"},{i:"🤝",t:"Industry Mentors",d:"High-clarity students need pro connections"},{i:"🚀",t:"Leadership Projects",d:"Enterprising types – cross-class leadership"},{i:"📄",t:"Resume & Portfolio",d:"Build first professional documents"}],
  "11S":[{i:"🔬",t:"Lab & Research",d:"Investigative – extended projects & papers"},{i:"🌱",t:"Biology Field Study",d:"Naturalistic intelligence – ecology projects"},{i:"🗣",t:"Science Communication",d:"Critical gap: low Communication – peer teaching"},{i:"🎯",t:"NEET/JEE Alignment",d:"Map aspirations to competitive exam strategy"}],
};
const lsLabels={"Logical-Mathematical":"Logical-Math","Interpersonal":"Interpersonal","Linguistic":"Linguistic","Spatial-Visual":"Spatial","Bodily-Kinesthetic":"Kinesthetic","Intrapersonal":"Intrapersonal","Musical":"Musical","Naturalistic":"Naturalistic"};

function updateTeacherDash(){
  const cls=document.getElementById('classSelector').value;
  const redOnly=document.getElementById('redFlagOnly').checked;
  document.getElementById('classLabelH').textContent='Grade '+cls;
  const students=mockStudents.filter(s=>s.cls===cls);
  const shown=redOnly?students.filter(s=>s.redFlag||s.cci==='Low'):students;

  document.getElementById('totalStudentsBadge').textContent=students.length+' students';

  // Badges
  const hCCI=students.filter(s=>s.cci==='High').length;
  const flags=students.filter(s=>s.redFlag||s.cci==='Low').length;
  document.getElementById('classSummaryBadges').innerHTML=
    `<span class="badge bh">${hCCI} High CCI</span><span class="badge bl">${flags} flags</span><span class="badge bn">${students.length-hCCI-flags} Moderate</span>`;

  // Populate note student select
  const sel=document.getElementById('noteStudentSelect');
  sel.innerHTML='<option value="">Select student (optional)</option>'+students.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');

  // Learning styles of class
  const lsCounts={};
  students.forEach(s=>s.intel.slice(0,1).forEach(i=>{lsCounts[i]=(lsCounts[i]||0)+1}));
  const lsKeys=Object.keys(lsCounts).sort((a,b)=>lsCounts[b]-lsCounts[a]);
  const lsVals=lsKeys.map(k=>Math.round(lsCounts[k]/students.length*100));
  if(teacherIntelI)teacherIntelI.destroy();
  teacherIntelI=new Chart(document.getElementById('teacherIntelChart'),{
    type:'bar',
    data:{labels:lsKeys.map(k=>lsLabels[k]||k),datasets:[{label:'% dominant style',data:lsVals,backgroundColor:'#0C6B5A',borderRadius:4}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{max:80,ticks:{callback:v=>v+'%'},grid:{color:'#E5E7EB'}}}}
  });
  // Insight for learning styles
  const topLS=lsKeys[0];
  const lsInsights={
    "Logical-Mathematical":"Logical-Mathematical is the dominant style. Use data problems, scientific method, and analytical tasks for best engagement.",
    "Interpersonal":"Interpersonal style dominates. Group discussions, peer teaching, and collaborative projects work best.",
    "Linguistic":"Linguistic learners dominate. Reading-based tasks, storytelling, and debate activities are highly effective.",
    "Spatial-Visual":"Spatial-Visual is top style. Mind maps, diagrams, video content, and visual presentations engage this class.",
    "Bodily-Kinesthetic":"Kinesthetic learners dominate. Hands-on labs, role-plays, and movement activities are best.",
    "Intrapersonal":"Intrapersonal style is high. Individual reflection, self-paced projects, and journaling work well.",
    "Musical":"Musical intelligence is present. Use rhythm, pattern, and music-based mnemonics in teaching.",
    "Naturalistic":"Naturalistic learners are strong. Outdoor activities, field studies, and ecology projects suit this class.",
  };
  document.getElementById('lsClassInsight').querySelector('span:last-child').textContent=lsInsights[topLS]||"Use diverse teaching methods to reach all learning styles.";

  // Abilities
  const abilAll=['Computational','Communication','Technical','Logical reasoning','Creativity','Decision making'];
  const abilScores=abilAll.map(a=>Math.round(students.filter(s=>s.abilities.includes(a)).length/students.length*100));
  if(teacherAbilI)teacherAbilI.destroy();
  teacherAbilI=new Chart(document.getElementById('teacherAbilChart'),{
    type:'bar',
    data:{labels:abilAll.map(a=>a.length>12?a.slice(0,12)+'…':a),datasets:[{label:'%',data:abilScores,backgroundColor:abilScores.map(v=>v>=60?'#36B37E':v>=40?'#F59E0B':'#EF4444'),borderRadius:4}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:10}}},y:{max:100,ticks:{callback:v=>v+'%'},grid:{color:'#E5E7EB'}}}}
  });

  // Student table
  const tb=document.getElementById('teacherStudentTable');
  tb.innerHTML='';
  shown.forEach(s=>{
    const cciCl=s.cci==='High'?'bh':s.cci==='Moderate'?'bm':'bl';
    const flag=s.redFlag||s.cci==='Low';
    const support=flag?'<span class="dot dr"></span>High':s.cci==='Moderate'?'<span class="dot dy"></span>Medium':'<span class="dot dg"></span>On Track';
    const tr=document.createElement('tr');
    if(flag)tr.style.background='#FFF5F5';
    tr.innerHTML=`<td style="font-weight:500">${s.name}${flag?' <span class="badge bl" style="font-size:9px">⚠</span>':''}</td>
      <td style="font-size:11px">${s.personality[0]}</td>
      <td style="font-size:11px">${lsLabels[s.intel[0]]||s.intel[0]}</td>
      <td style="font-size:11px;color:var(--acc)">${s.weakAbility}</td>
      <td><span class="badge ${cciCl}">${s.cci}</span></td>
      <td style="font-size:11px">${support}</td>
      <td><button class="rc-modal-btn" onclick="openReportCardModal(${s.id})">📝 Summary</button></td>`;
    tb.appendChild(tr);
  });

  // Section comparison
  const gradeStr=cls.replace(/[AB S]/g,'');
  const grade=parseInt(gradeStr)||parseInt(cls[0])||9;
  buildSectionComparison(cls,grade);

  // Strategies
  const strats=classStrategies[cls]||classStrategies['9A'];
  document.getElementById('strategyGrid').innerHTML=strats.map(st=>`<div class="strat-card"><div class="strat-icon">${st.i}</div><div class="strat-title">${st.t}</div><div class="strat-desc">${st.d}</div></div>`).join('');

  // Show sent notes
  renderTeacherNotes(cls);
}

function buildSectionComparison(myCls,grade){
  const grp=String(grade);
  const comp=sectionCompData[grp]||sectionCompData['9'];
  const myIdx=comp.sections.indexOf(myCls);
  const el=document.getElementById('sectionComparison');
  el.innerHTML=`<div style="font-size:11px;color:var(--muted);margin-bottom:8px">High CCI % by Section — Grade ${grade}</div>`+
  comp.sections.map((sec,i)=>`<div class="comp-bar-wrap">
    <div class="comp-bar-label ${i===myIdx?'my-section':''}">${sec}${i===myIdx?' ★':''}</div>
    <div class="comp-bar-inner"><div class="pb"><div class="pf" style="width:${comp.cci.high[i]}%;background:${i===myIdx?'var(--p)':'#36B37E88'}"></div></div></div>
    <div class="comp-bar-val ${i===myIdx?'my-section':''}">${comp.cci.high[i]}%</div>
  </div>`).join('');

  const rank=comp.cci.high.map((v,i)=>({sec:comp.sections[i],val:v})).sort((a,b)=>b.val-a.val);
  const myRank=rank.findIndex(r=>r.sec===myCls)+1;
  const total=comp.sections.length;
  document.getElementById('sectionRanks').innerHTML=`
    <div style="font-size:11px;margin-bottom:6px">CCI Rank: <strong style="color:${myRank===1?'var(--s)':'var(--acc)'}">
      ${myRank} / ${total}</strong> ${myRank===1?'🏆 Top section!':'— room to improve'}</div>
    <div style="font-size:11px;color:var(--muted)">Avg Ability Score: <strong>${comp.avgAbility[myIdx]||65}%</strong></div>
    <div style="font-size:11px;color:var(--muted);margin-top:3px">Avg Learning Style Score: <strong>${comp.avgLS[myIdx]||68}%</strong></div>`;
}

function sendTeacherNote(){
  const cls=document.getElementById('classSelector').value;
  const text=document.getElementById('teacherNoteText').value.trim();
  const sid=document.getElementById('noteStudentSelect').value;
  if(!text)return;
  const sName=sid?mockStudents.find(s=>s.id==sid)?.name:'General class note';
  const note={from:'teacher'+cls,fromLabel:'Teacher – Grade '+cls,student:sName,body:text,time:'Just now',read:false,replies:[]};
  messages.unshift({...note,id:Date.now()});
  teacherNotes.unshift({cls,student:sName,body:text,time:'Just now'});
  document.getElementById('teacherNoteText').value='';
  updateNotifCount();
  renderTeacherNotes(cls);
  alert('Note sent to Counsellor.');
}

function renderTeacherNotes(cls){
  const el=document.getElementById('teacherNotesSent');
  const notes=teacherNotes.filter(n=>n.cls===cls);
  el.innerHTML=notes.length?notes.map(n=>`<div class="note-item">
    <div class="note-meta"><span>${n.student}</span><span>${n.time}</span></div>
    <div>${n.body}</div>
  </div>`).join(''):'<div style="font-size:11px;color:var(--muted)">No notes sent yet for this class.</div>';
}

// ══════════════ COUNSELLOR ══════════════
function counsellorFilter(){
  currentGradeFilter=document.getElementById('cGradeFilter').value;
  currentSectionFilter=document.getElementById('cSectionFilter').value;
  currentPersonFilter=document.getElementById('cPersonFilter').value;
  renderStudentList();
  renderCounsellorAggr();
}

function getFilteredStudents(){
  return mockStudents.filter(s=>{
    const gMatch=currentGradeFilter==='all'||String(s.grade)===currentGradeFilter;
    const sMatch=currentSectionFilter==='all'||s.section===currentSectionFilter;
    const pMatch=currentPersonFilter==='all'||s.personality[0]===currentPersonFilter;
    const cMatch=cciFilter==='all'||s.cci===cciFilter;
    const srch=document.getElementById('sSearchInput')?.value.toLowerCase()||'';
    const nameMatch=!srch||s.name.toLowerCase().includes(srch);
    return gMatch&&sMatch&&pMatch&&cMatch&&nameMatch;
  });
}

function renderCounsellorAggr(){
  const students=getFilteredStudents();
  document.getElementById('filterCount').textContent=students.length+' students';

  // Personality donut
  const pCounts={};
  students.forEach(s=>{const p=s.personality[0];pCounts[p]=(pCounts[p]||0)+1;});
  const pKeys=Object.keys(pCounts).sort((a,b)=>pCounts[b]-pCounts[a]).slice(0,5);
  if(cPersonChartI)cPersonChartI.destroy();
  cPersonChartI=new Chart(document.getElementById('cPersonChart'),{
    type:'doughnut',
    data:{labels:pKeys,datasets:[{data:pKeys.map(k=>pCounts[k]),backgroundColor:['#0C6B5A','#36B37E','#F59E0B','#3B82F6','#EF4444'],borderWidth:2}]},
    options:{responsive:true,plugins:{legend:{position:'bottom',labels:{boxWidth:9,font:{size:10}}}}}
  });

  // CCI donut
  const cciC={High:0,Moderate:0,Low:0};
  students.forEach(s=>{if(s.cci==='High')cciC.High++;else if(s.cci==='Moderate')cciC.Moderate++;else cciC.Low++;});
  if(cCCIChartI)cCCIChartI.destroy();
  cCCIChartI=new Chart(document.getElementById('cCCIChart'),{
    type:'doughnut',
    data:{labels:['High','Moderate','Low/None'],datasets:[{data:[cciC.High,cciC.Moderate,cciC.Low],backgroundColor:['#059669','#D97706','#DC2626'],borderWidth:2}]},
    options:{responsive:true,plugins:{legend:{position:'bottom',labels:{boxWidth:9,font:{size:10}}}}}
  });

  // Top aspirations (mock for now)
  const aspNames=['Engineering','Computer Science','Medicine','Science','Commerce','Creative Arts','Social Service','Law'];
  const aspVals=[14,11,9,8,7,5,4,3];
  const max=aspVals[0];
  document.getElementById('topAsp').innerHTML=aspNames.map((n,i)=>`<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
    <div style="font-size:10px;width:100px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${n}</div>
    <div style="flex:1"><div class="pb"><div class="pf" style="width:${aspVals[i]/max*100}%;background:var(--p)"></div></div></div>
    <div style="font-size:10px;font-weight:600;width:18px;text-align:right">${aspVals[i]}</div>
  </div>`).join('');
}

function renderStudentList(){
  const students=getFilteredStudents();
  document.getElementById('studentList').innerHTML=students.map(s=>{
    const cciCl=s.cci==='High'?'bh':s.cci==='Moderate'?'bm':'bl';
    return`<div class="sitem ${selectedStudentId===s.id?'active':''}" onclick="selectStudent(${s.id})">
      <div>
        <div class="sitem-name">${s.name}${s.redFlag?'<span style="color:var(--danger);margin-left:3px;font-size:10px">●</span>':''}</div>
        <div class="sitem-cls">${s.cls} · Gr ${s.grade}</div>
      </div>
      <span class="badge ${cciCl}" style="font-size:9px">${s.cci}</span>
    </div>`;
  }).join('');
}

function filterSList(v){renderStudentList();}
function setCCIFilter(f,el){
  cciFilter=f;
  document.querySelectorAll('.ctab').forEach(t=>{t.className='ctab';});
  const cls=f==='all'?'ctab-all':f==='High'?'ctab-high':f==='Moderate'?'ctab-mod':'ctab-low';
  el.className='ctab '+cls;
  renderStudentList();
  renderCounsellorAggr();
}

function selectStudent(id){
  selectedStudentId=id;
  const s=mockStudents.find(st=>st.id===id);
  renderStudentList();
  const inits=s.name.split(' ').map(n=>n[0]).join('').slice(0,2);
  const cciCl=s.cci==='High'?'bh':s.cci==='Moderate'?'bm':'bl';
  document.getElementById('studentDetailCard').innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--p);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0">${inits}</div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px">${s.name} ${s.redFlag?'<span class="badge bl" style="font-size:9px">⚠ Red Flag</span>':''}</div>
        <div style="font-size:10px;color:var(--muted)">${s.cls} · Grade ${s.grade}</div>
      </div>
      <span class="badge ${cciCl}">${s.cci} CCI</span>
    </div>
    <div class="g2" style="margin-bottom:0;gap:10px">
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:6px">6 Pillars</div>
        <div style="font-size:11px;margin-bottom:2px"><strong>Personality:</strong> ${s.personality.join(', ')}</div>
        <div style="font-size:11px;margin-bottom:2px"><strong>Learning Style:</strong> ${s.intel.join(', ')}</div>
        <div style="font-size:11px;margin-bottom:2px"><strong>Top Abilities:</strong> ${s.abilities.join(', ')}</div>
        <div style="font-size:11px;color:var(--danger)"><strong>Weak:</strong> ${s.weakAbility}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Direction</div>
        <div style="font-size:11px;margin-bottom:4px"><strong>Aspirations:</strong></div>
        <div style="display:flex;flex-wrap:wrap;gap:3px">${(s.aspirations||['Not set']).slice(0,3).map(a=>`<span class="badge bb">${a}</span>`).join('')}</div>
      </div>
    </div>`;
  const notes=sessionNotes[id]||[];
  document.getElementById('notesList').innerHTML=notes.length?notes.map((n,i)=>`<div class="note-item">
    <div class="note-meta"><span>Note ${i+1}</span><span>Session</span></div>
    <div>${n}</div>
  </div>`).join(''):'<div style="font-size:11px;color:var(--muted)">No notes yet.</div>';
}

function saveNote(){
  if(!selectedStudentId)return alert('Select a student first');
  const text=document.getElementById('newNoteText').value.trim();
  if(!text)return;
  if(!sessionNotes[selectedStudentId])sessionNotes[selectedStudentId]=[];
  sessionNotes[selectedStudentId].push(text);
  selectStudent(selectedStudentId);
  document.getElementById('newNoteText').value='';
}

// ══════════════ MESSAGES ══════════════
function renderMessages(){
  const el=document.getElementById('counsellorMessages');
  el.innerHTML=messages.map(m=>`<div class="msg-item" id="msg-${m.id}">
    <div class="msg-from ${m.from==='principal'?'from-principal':'from-teacher'}">${m.read?'':'<span class="unread-dot"></span>'}<strong>${m.fromLabel}</strong>${m.student?' · Re: '+m.student:''}</div>
    <div class="msg-body">${m.body}</div>
    <div class="msg-time">${m.time}</div>
    ${m.replies.map(r=>`<div class="note-reply"><div class="note-reply-meta">↩ Counsellor replied · ${r.time}</div>${r.body}</div>`).join('')}
    <div style="margin-top:6px">
      <button class="btn btn-sm" onclick="quickReply(${m.id})">↩ Reply</button>
      ${!m.read?`<button class="btn btn-sm" style="margin-left:4px" onclick="markRead(${m.id})">Mark Read</button>`:''}
    </div>
  </div>`).join('');
  updateNotifCount();
}

function quickReply(msgId){
  const text=prompt('Reply to this message:');
  if(!text)return;
  const msg=messages.find(m=>m.id===msgId);
  if(msg){msg.replies.push({body:text,time:'Just now'});msg.read=true;}
  renderMessages();
}

function markRead(id){
  const m=messages.find(msg=>msg.id===id);
  if(m)m.read=true;
  renderMessages();
  updateNotifCount();
}

function sendReply(){
  const target=document.getElementById('replyTarget').value;
  const text=document.getElementById('replyText').value.trim();
  if(!target||!text)return alert('Select recipient and write a message');
  alert(`Message sent to: ${target}`);
  document.getElementById('replyText').value='';
}

function updateNotifCount(){
  const unread=messages.filter(m=>!m.read).length;
  const el=document.getElementById('notifCount');
  el.textContent=unread;
  el.style.display=unread?'block':'none';
  const ub=document.getElementById('unreadBadge');
  if(ub)ub.textContent=unread+' unread';
  document.getElementById('unreadBadge').style.display=unread?'inline-block':'none';
}

// ══════════════ FIELD TRIP REQUEST ══════════════
function sendFieldTripRequest(){
  const grade=document.getElementById('ftGrade').value;
  const note=document.getElementById('ftNote').value.trim();
  if(grade==='Select Grade Group')return alert('Please select a grade group');
  if(!note)return alert('Please add some context for the counsellor');
  messages.unshift({
    id:Date.now(),from:'principal',fromLabel:'Principal – Field Trip Request',
    student:null,
    body:`Field Trip Planning Request — ${grade}\n\n${note}\n\nPlease review Navigator data for this grade group and suggest 2–3 profile-matched destinations, then conduct pre-trip orientation sessions.`,
    time:'Just now',read:false,replies:[]
  });
  updateNotifCount();
  document.getElementById('ftNote').value='';
  closeModal('fieldTripModal');
  alert(`✅ Field trip planning request sent to Counsellor for ${grade}.\nCounsellor will receive this in their messages panel.`);
}

// ══════════════ REPORT CARD SUMMARY ══════════════
let reportCardStudentId = null;

function openReportCardModal(id) {
  reportCardStudentId = id;
  const s = mockStudents.find(st => st.id === id);
  const cls = document.getElementById('classSelector').value;
  const cciColor = s.cci === 'High' ? '#065F46' : s.cci === 'Moderate' ? '#92400E' : '#991B1B';
  const today = new Date().toLocaleDateString('en-IN', {day:'numeric', month:'long', year:'numeric'});

  document.getElementById('reportCardBody').innerHTML = `
    <div style="background:#FAFCFB;border:1px solid var(--border);border-radius:var(--rs);padding:14px;margin-bottom:14px;font-size:11px;color:var(--muted)">
      💡 This summary is designed to be copied into the student's academic report card. It is concise, professional, and parent-friendly. You can edit the text before copying.
    </div>
    <div id="rcTextBlock" style="background:#fff;border:2px solid var(--border);border-radius:var(--r);padding:20px;font-family:Georgia,serif;line-height:1.75;font-size:13px;color:#1A2B28">
      <div style="text-align:center;border-bottom:2px solid #D1E5DF;padding-bottom:12px;margin-bottom:16px">
        <div style="font-size:16px;font-weight:700;color:#084A3E">Career Navigator 360 — Student Profile Summary</div>
        <div style="font-size:11px;color:#5C7A72;margin-top:4px">Academic Year 2024–25 · Assessed via Navigator 360 · ${today}</div>
      </div>

      <table style="width:100%;margin-bottom:14px;border-collapse:collapse;font-size:12px">
        <tr><td style="padding:4px 8px;font-weight:600;width:160px;color:#5C7A72">Student Name</td><td style="padding:4px 8px;font-weight:700;color:#084A3E">${s.name}</td>
            <td style="padding:4px 8px;font-weight:600;width:140px;color:#5C7A72">Grade &amp; Section</td><td style="padding:4px 8px">${s.cls}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:600;color:#5C7A72">Career Clarity</td>
            <td style="padding:4px 8px;font-weight:700;color:${cciColor}">${s.cci} Career Clarity</td>
            <td style="padding:4px 8px;font-weight:600;color:#5C7A72">Assessment Stage</td>
            <td style="padding:4px 8px">${s.grade<=8?'Insight Navigator (Gr 6–8)':s.grade<=10?'Subject Navigator (Gr 9–10)':'Career Navigator (Gr 11–12)'}</td></tr>
      </table>

      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:#084A3E;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;border-left:3px solid #36B37E;padding-left:8px">Personality &amp; Learning Profile</div>
        <p style="font-size:12px;margin:0;color:#1A2B28">
          ${s.name} demonstrates a predominantly <strong>${s.personality[0]}</strong> personality type, supported by <strong>${s.personality[1]}</strong> tendencies.
          As a learner, ${s.name.split(' ')[0]} shows the strongest aptitude through <strong>${s.intel[0]}</strong> and <strong>${s.intel[1]}</strong> learning styles,
          reflecting a natural inclination toward ${s.intel[0]==='Logical-Mathematical'?'analytical thinking and problem-solving':
          s.intel[0]==='Interpersonal'?'collaborative work and social engagement':
          s.intel[0]==='Linguistic'?'language, reading, and communication':
          s.intel[0]==='Spatial-Visual'?'visual thinking and creative design':
          s.intel[0]==='Bodily-Kinesthetic'?'hands-on, practical activity':
          s.intel[0]==='Intrapersonal'?'self-directed, reflective learning':
          s.intel[0]==='Musical'?'pattern recognition and rhythm-based learning':
          'nature, environment, and classification tasks'}.
        </p>
      </div>

      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:#084A3E;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;border-left:3px solid #36B37E;padding-left:8px">Key Strengths</div>
        <p style="font-size:12px;margin:0;color:#1A2B28">
          ${s.name.split(' ')[0]}'s assessed abilities highlight particular strength in <strong>${s.abilities[0]}</strong>, <strong>${s.abilities[1]}</strong>, and <strong>${s.abilities[2]}</strong>.
          These competencies align well with academic performance and indicate readiness for career paths requiring these skills.
          An identified area for development is <strong>${s.weakAbility}</strong>, and targeted activities in this area are recommended for the coming academic term.
        </p>
      </div>

      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:#084A3E;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;border-left:3px solid #36B37E;padding-left:8px">Career Direction &amp; Subjects of Interest</div>
        <p style="font-size:12px;margin:0;color:#1A2B28">
          Based on the Navigator 360 assessment, ${s.name.split(' ')[0]} has expressed interest in
          <strong>${(s.aspirations||['career exploration']).slice(0,2).join(' and ')}</strong>.
          The suitability analysis indicates strong alignment with <strong>${(s.suitability||['multiple career fields']).slice(0,2).join(' and ')}</strong>.
          ${s.cci==='High'?`${s.name.split(' ')[0]} shows a high degree of career clarity and is well-positioned to make informed decisions for stream and subject selection.`:
           s.cci==='Moderate'?`${s.name.split(' ')[0]} shows emerging career clarity. Continued guidance and exposure to relevant fields will support better alignment.`:
           `Career clarity is still developing. A dedicated counselling session is recommended to help ${s.name.split(' ')[0]} explore and connect with suitable career paths.`}
        </p>
      </div>

      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:#084A3E;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;border-left:3px solid #36B37E;padding-left:8px">Teacher's Recommendations for the Coming Term</div>
        <p style="font-size:12px;margin:0;color:#1A2B28">
          1. Provide <strong>${s.weakAbility.toLowerCase()}</strong>-building opportunities through class activities and assignments.<br>
          2. Encourage participation in extracurricular activities aligned with ${s.name.split(' ')[0]}'s <strong>${s.personality[0]}</strong> personality and <strong>${s.intel[0]}</strong> learning preference.<br>
          3. ${s.cci==='Low'||s.redFlag?`<strong>Recommend a counselling session</strong> to address career clarity and identify concrete next steps.`:
             `Continue to reinforce strengths and guide subject selection consistent with identified career interests.`}
        </p>
      </div>

      <div style="background:#E0F2EE;border-radius:var(--rs);padding:10px 12px;font-size:11px;color:#084A3E;margin-top:14px">
        <em>This summary has been generated using the Career Navigator 360 psychometric assessment. For detailed pillar-level scores and a full career suitability report, please refer to the student's individual Navigator 360 report available with the school counsellor.</em>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;align-items:center">
      <button onclick="copyReportCard()" class="btn btn-primary btn-sm">📋 Copy to Clipboard</button>
      <button onclick="downloadReport('reportcard')" class="dl-btn" style="font-size:11px">📥 Download as PDF</button>
      <span id="rcCopyMsg" style="display:none;font-size:11px;color:var(--s);font-weight:600">✔ Copied!</span>
    </div>`;

  openModal('reportCard');
}

function copyReportCard() {
  const el = document.getElementById('rcTextBlock');
  const text = el ? el.innerText : '';
  navigator.clipboard.writeText(text).then(() => {
    const msg = document.getElementById('rcCopyMsg');
    if(msg){msg.style.display='inline';setTimeout(()=>msg.style.display='none',2500);}
  }).catch(()=>alert('Text ready — please use Ctrl+A / Ctrl+C on the report card text above.'));
}

// ══════════════ DOWNLOAD / EXPORT ══════════════
function downloadReport(type) {
  const labels = {
    full: 'Navigator 360 Full Report — Aarav Sharma.pdf',
    summary: 'Career Clarity Summary — Aarav Sharma.pdf',
    parent: 'Parent Report — Aarav Sharma.pdf',
    counsellor: 'Counsellor Report.pdf',
    reportcard: 'Report Card Summary.pdf',
  };
  const label = labels[type] || 'Report.pdf';
  // In production this would trigger a real PDF generation call.
  // For this prototype we show a confirmation toast.
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#084A3E;color:#fff;padding:12px 18px;border-radius:10px;font-size:12px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.25);display:flex;align-items:center;gap:8px';
  toast.innerHTML = `📥 Generating <em>${label}</em>…`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.innerHTML = `✔ ${label} ready — saved to Downloads`; }, 1400);
  setTimeout(() => toast.remove(), 3800);
}

// ══════════════ STUDENT APPOINTMENTS ══════════════


function selectStudentSlot(btn, slot) {
  document.querySelectorAll('#studentApptSlots button').forEach(b => { b.textContent='Select'; b.style.background=''; b.style.color=''; });
  btn.textContent = '✔ Selected';
  btn.style.background = 'var(--p)';
  btn.style.color = '#fff';
  document.getElementById('apptConfirm').style.display = 'none';
  window._selectedSlot = slot;
}

function bookStudentAppt() {
  const slot = window._selectedSlot;
  const conf = document.getElementById('apptConfirm');
  if (!slot) { conf.style.display='block'; conf.style.background='#FEE2E2'; conf.style.color='#991B1B'; conf.textContent='Please select a slot first.'; return; }
  conf.style.display = 'block';
  conf.style.background = '#D1FAE5';
  conf.style.color = '#065F46';
  conf.textContent = `✔ Appointment requested for ${slot}. Your counsellor will confirm shortly.`;
  // Push to counsellor messages
  messages.unshift({id:Date.now(),from:'student',fromLabel:'Student Request',student:'Aarav Sharma',body:`Appointment booking request: ${slot} — Career Counselling Session.`,time:'Just now',read:false,replies:[]});
  updateNotifCount();
  window._selectedSlot = null;
}

// ══════════════ COUNSELLOR CALENDAR ══════════════
let calYear, calMonth, calAppointments = {};

function initCalendar() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  // Seed some demo appointments
  const d = (day) => `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  calAppointments[d(8)]  = [{time:'10:00 AM',student:'Divya Sharma',type:'Red Flag Intervention'},{time:'2:30 PM',student:'Shruti Kulkarni',type:'CCI Review'}];
  calAppointments[d(13)] = [{time:'11:30 AM',student:'Anjali Tiwari',type:'Career Counselling'}];
  calAppointments[d(16)] = [{time:'3:00 PM',student:'Amit Verma',type:'Parent + Student Session'}];
  calAppointments[d(21)] = [{time:'9:30 AM',student:'Pooja Iyer',type:'Stream Selection Guidance'}];
  // Populate student dropdown
  const sel = document.getElementById('apptStudentSel');
  if(sel) sel.innerHTML = '<option value="">Select student...</option>' +
    mockStudents.map(s=>`<option value="${s.id}">${s.name} (${s.cls})</option>`).join('');
  renderCalendar();
}

function renderCalendar() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonth').textContent = `${months[calMonth]} ${calYear}`;
  const grid = document.getElementById('calDays');
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const today = new Date();
  let html = '';
  for(let i=0;i<firstDay;i++) html += `<div class="cal-day empty"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const key = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = today.getDate()===d && today.getMonth()===calMonth && today.getFullYear()===calYear;
    const hasAppt = calAppointments[key] && calAppointments[key].length > 0;
    html += `<div class="cal-day ${isToday?'today':''} ${hasAppt&&!isToday?'has-appt':''}" onclick="showDayAppts('${key}',${d})">${d}</div>`;
  }
  grid.innerHTML = html;
}

function calNav(dir) {
  calMonth += dir;
  if(calMonth < 0){ calMonth=11; calYear--; }
  if(calMonth > 11){ calMonth=0; calYear++; }
  renderCalendar();
  document.getElementById('apptList').innerHTML = '<div style="font-size:11px;color:var(--muted);text-align:center;padding:10px">Click a date to view appointments</div>';
}

function showDayAppts(key, day) {
  const appts = calAppointments[key] || [];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = `${day} ${months[calMonth]} ${calYear}`;
  const el = document.getElementById('apptList');
  if(appts.length === 0){
    el.innerHTML = `<div style="font-size:11px;color:var(--muted);text-align:center;padding:10px">${dateStr} — No appointments scheduled.<br><span style="color:var(--p);cursor:pointer" onclick="focusBookForm('${key}')">+ Book one below</span></div>`;
  } else {
    el.innerHTML = `<div style="font-size:11px;font-weight:700;color:var(--pd);margin-bottom:6px">${dateStr}</div>` +
      appts.map(a=>`<div class="appt-item">
        <div class="appt-time">${a.time}</div>
        <div class="appt-student">${a.student}</div>
        <div class="appt-type">${a.type}</div>
      </div>`).join('');
  }
}

function focusBookForm(dateStr) {
  const dateInput = document.getElementById('apptDate');
  if(dateInput) dateInput.value = dateStr;
  dateInput.scrollIntoView({behavior:'smooth', block:'center'});
}

function bookAppt() {
  const sid = document.getElementById('apptStudentSel').value;
  const date = document.getElementById('apptDate').value;
  const time = document.getElementById('apptTime').value;
  const type = document.getElementById('apptType').value;
  const msg = document.getElementById('apptBookedMsg');
  if(!sid || !date){ msg.style.display='block'; msg.style.background='#FEE2E2'; msg.style.color='#991B1B'; msg.textContent='Please select a student and date.'; return; }
  const student = mockStudents.find(s=>s.id==sid);
  if(!calAppointments[date]) calAppointments[date] = [];
  calAppointments[date].push({time, student:student.name, type});
  renderCalendar();
  showDayAppts(date, parseInt(date.split('-')[2]));
  msg.style.display = 'block';
  msg.style.background = '#D1FAE5';
  msg.style.color = '#065F46';
  msg.textContent = `✔ Appointment booked — ${student.name} · ${date} · ${time}`;
  setTimeout(()=>msg.style.display='none', 3000);
  document.getElementById('apptStudentSel').value = '';
  document.getElementById('apptDate').value = '';
}

// ══════════════ STUDENT RADAR ══════════════
function renderStudentRadar(){
  new Chart(document.getElementById('studentRadarChart'),{
    type:'radar',
    data:{
      labels:['Personality','Learning Style','Ability','Values','Subjects','Aspirations'],
      datasets:[{label:'Your Profile',data:[78,82,71,85,74,68],borderColor:'#0C6B5A',backgroundColor:'rgba(12,107,90,0.15)',pointBackgroundColor:'#0C6B5A',borderWidth:2,pointRadius:4}]
    },
    options:{responsive:true,plugins:{legend:{display:false}},scales:{r:{min:50,max:100,ticks:{display:false},grid:{color:'#E5E7EB'},pointLabels:{font:{size:10}}}}}
  });
}
