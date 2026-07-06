// ─── CONSTANTS & UTILITIES ──────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PHASE_COLORS = ['#1a5fb4','#1baf7a','#eda100','#4a3aa7','#e34948','#eb6834','#e87ba4','#0f6e56'];
const RESP_LIST = ['Thomas','Beat','Grégoire','Patrick','Daria'];
const CATEGORY_LIST = ['Pain','C&F','Hydration','Women wellbeing','Gummies'];
const RESP_CLS = {Thomas:'badge-T',Beat:'badge-B','Grégoire':'badge-G',Patrick:'badge-P',Daria:'badge-D'};
const EXT_LIST = ['Spirig','Swissmedic','Alloga','Agency','Other partner'];
const STEP_STATUSES = [
  {v:'todo',   label:'To do',     cls:'status-todo'},
  {v:'progress',label:'In progress', cls:'status-progress'},
  {v:'done',   label:'Done',      cls:'status-done'},
];

// ─── SWISSMEDIC PROCEDURE TEMPLATES ──────────────────────────────────────────
// Source: Swissmedic ZL000_00_014 v10.0 (01.09.2025)
// CD = calendar days, converted to weeks (÷7, rounded to nearest 0.5)
const SMC_PROCEDURES = {
  'na_standard': {
    label: 'New authorisation — known active substance (national, standard)',
    totalCD: 540,
    phases: [{
      id:'smc_na', name:'SWISSMEDIC — New Authorisation (Standard)', color:'#eda100', collapsed:false,
      steps:[
        {id:'smc1', name:'Formal control (SMC)', note:'Swissmedic checks formal aspects of the dossier', weeks:4, status:'todo', owner:'Swissmedic'},
        {id:'smc2', name:'Correction of documents (Applicant)', note:'Applicant corrects any formal shortcomings', weeks:9, status:'todo', owner:'Thomas'},
        {id:'smc3', name:'Evaluation Phase I (SMC)', note:'Scientific evaluation — LoQ drawn up', weeks:17, status:'todo', owner:'Swissmedic'},
        {id:'smc4', name:'Reply to List of Questions (Applicant)', note:'Applicant responds to all LoQ points', weeks:13, status:'todo', owner:'Thomas'},
        {id:'smc5', name:'Evaluation Phase II (SMC)', note:'Evaluation of LoQ replies — ends with Preliminary Decision', weeks:13, status:'todo', owner:'Swissmedic'},
        {id:'smc6', name:'Reply to Preliminary Decision (Applicant)', note:'Applicant submits revised MPI texts & packaging', weeks:9, status:'todo', owner:'Thomas'},
        {id:'smc7', name:'Eval. of reply to PD — Official Decision (SMC)', note:'Labelling review + official decision', weeks:13, status:'todo', owner:'Swissmedic'},
      ]
    }]
  },

  'comarketing': {
    label: 'Co-marketing — new authorisation (national, standard)',
    totalCD: 240,
    phases: [{
      id:'smc_cm', name:'SWISSMEDIC — Co-Marketing Authorisation', color:'#1a5fb4', collapsed:false,
      steps:[
        {id:'smc_cm1', name:'Formal control (SMC)', note:'', weeks:4, status:'todo', owner:'Swissmedic'},
        {id:'smc_cm2', name:'Correction of documents (Applicant)', note:'', weeks:9, status:'todo', owner:'Thomas'},
        {id:'smc_cm3', name:'Evaluation Phase I (SMC)', note:'', weeks:4, status:'todo', owner:'Swissmedic'},
        {id:'smc_cm4', name:'Reply to List of Questions (Applicant)', note:'', weeks:4, status:'todo', owner:'Thomas'},
        {id:'smc_cm5', name:'Evaluation Phase II (SMC)', note:'', weeks:4, status:'todo', owner:'Swissmedic'},
        {id:'smc_cm6', name:'Reply to Preliminary Decision (Applicant)', note:'', weeks:4, status:'todo', owner:'Thomas'},
        {id:'smc_cm7', name:'Eval. of reply to PD — Official Decision (SMC)', note:'', weeks:4, status:'todo', owner:'Swissmedic'},
      ]
    }]
  },

  'ftp': {
    label: 'Fast-track procedure (FTP — Art. 7 TPO)',
    totalCD: 350,
    phases: [{
      id:'smc_ftp', name:'SWISSMEDIC — Fast-Track Procedure (FTP)', color:'#e34948', collapsed:false,
      steps:[
        {id:'smc_ftp1', name:'Formal control (SMC)', note:'Accelerated — only 5 calendar days', weeks:1, status:'todo', owner:'Swissmedic'},
        {id:'smc_ftp2', name:'Correction of documents (Applicant)', note:'', weeks:9, status:'todo', owner:'Thomas'},
        {id:'smc_ftp3', name:'Evaluation Phase I (SMC)', note:'', weeks:9, status:'todo', owner:'Swissmedic'},
        {id:'smc_ftp4', name:'Reply to List of Questions (Applicant)', note:'6-day submission window before HMEC date applies', weeks:13, status:'todo', owner:'Thomas'},
        {id:'smc_ftp5', name:'Evaluation Phase II (SMC)', note:'', weeks:7, status:'todo', owner:'Swissmedic'},
        {id:'smc_ftp6', name:'Reply to Preliminary Decision (Applicant)', note:'', weeks:9, status:'todo', owner:'Thomas'},
        {id:'smc_ftp7', name:'Eval. of reply to PD — Official Decision (SMC)', note:'', weeks:3, status:'todo', owner:'Swissmedic'},
      ]
    }]
  },

  'type_ib': {
    label: 'Variation Type IB (Art. 22 TPO)',
    totalCD: 100,
    phases: [{
      id:'smc_ib', name:'SWISSMEDIC — Variation Type IB', color:'#4a3aa7', collapsed:false,
      steps:[
        {id:'smc_ib1', name:'Formal control (SMC)', note:'', weeks:1, status:'todo', owner:'Swissmedic'},
        {id:'smc_ib2', name:'Correction of documents (Applicant)', note:'', weeks:4, status:'todo', owner:'Thomas'},
        {id:'smc_ib3', name:'Evaluation → Interim order / Official Decision (SMC)', note:'No LoQ phase in standard IB procedure', weeks:9, status:'todo', owner:'Swissmedic'},
      ]
    }]
  },

  'type_ii': {
    label: 'Variation Type II (Art. 23 TPO)',
    totalCD: 450,
    phases: [{
      id:'smc_ii', name:'SWISSMEDIC — Variation Type II', color:'#0f6e56', collapsed:false,
      steps:[
        {id:'smc_ii1', name:'Formal control (SMC)', note:'', weeks:4, status:'todo', owner:'Swissmedic'},
        {id:'smc_ii2', name:'Correction of documents (Applicant)', note:'', weeks:9, status:'todo', owner:'Thomas'},
        {id:'smc_ii3', name:'Evaluation Phase I (SMC)', note:'', weeks:17, status:'todo', owner:'Swissmedic'},
        {id:'smc_ii4', name:'Reply to List of Questions (Applicant)', note:'', weeks:9, status:'todo', owner:'Thomas'},
        {id:'smc_ii5', name:'Evaluation Phase II (SMC)', note:'', weeks:10, status:'todo', owner:'Swissmedic'},
        {id:'smc_ii6', name:'Reply to Preliminary Decision (Applicant)', note:'', weeks:9, status:'todo', owner:'Thomas'},
        {id:'smc_ii7', name:'Eval. of reply to PD — Official Decision (SMC)', note:'', weeks:7, status:'todo', owner:'Swissmedic'},
      ]
    }]
  },
};

const COMARKETING_PHASE = {
  id:'ph1', name:'CO-MARKETING & SUPPLY AGREEMENT', color:'#1a5fb4', collapsed:false,
    steps:[
      {id:'s1',name:'Amendment signature',note:'',weeks:1,status:'todo',owner:'Thomas'},
      {id:'s2',name:'Co-marketing & supply agreement',note:'',weeks:4,status:'todo',owner:'Spirig'},
      {id:'s3',name:'Signatures for co-marketing form',note:'',weeks:1,status:'todo',owner:'Thomas'},
    ]};

const DEFAULT_PHASES_CORE = [
  {id:'ph3', name:'AW & PRODUCTION', color:'#4a3aa7', collapsed:false,
    steps:[
      {id:'s6',name:'Print proof prep',note:'',weeks:2,status:'todo',owner:'Spirig'},
      {id:'s7',name:'AW approval & order',note:'',weeks:4,status:'todo',owner:'Spirig'},
      {id:'s8',name:'AW supply',note:'',weeks:9,status:'todo',owner:'Spirig'},
      {id:'s9',name:'Production',note:'',weeks:8,status:'todo',owner:'Spirig'},
    ]},
  {id:'ph4', name:'RELEASE & DISTRIBUTION', color:'#1baf7a', collapsed:false,
    steps:[
      {id:'s10',name:'Release lead time',note:'',weeks:6,status:'todo',owner:'Spirig'},
      {id:'s11',name:'Delivery at Alloga',note:'',weeks:1,status:'todo',owner:'Alloga'},
      {id:'s12',name:'Release (Quality — Batch Release)',note:'',weeks:1,status:'todo',owner:'Alloga'},
      {id:'s13',name:'Distribution',note:'',weeks:1,status:'todo',owner:'Alloga'},
    ]}
];

function deepCopy(o){return JSON.parse(JSON.stringify(o));}
function uid(){return 'id_'+Math.random().toString(36).slice(2,9);}
function notify(msg){const n=document.getElementById('notif');n.textContent=msg;n.classList.add('show');setTimeout(()=>n.classList.remove('show'),2200);}
function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
function todayStr(){return new Date().toISOString().slice(0,10);}

// ─── STORAGE (shared via Supabase — visible to whole UPSA CH team) ──────────