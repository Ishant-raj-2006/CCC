// Champaran Coaching Center - Firebase Sync Full Version
const firebaseConfig = {
  apiKey: "AIzaSyCTkM0HrrIOb3D1IOp5nLOh7unRLwu1nxw",
  authDomain: "champaran-choching-center.firebaseapp.com",
  databaseURL: "https://champaran-choching-center-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "champaran-choching-center",
  storageBucket: "champaran-choching-center.firebasestorage.app",
  messagingSenderId: "473187056929",
  appId: "1:473187056929:web:c62bdc65d3038a93141260",
  measurementId: "G-SXM6HBBWEX"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);


let currentData = {
    students: [],
    timetable: { "8": "TBA", "9": "TBA", "10": "TBA", "11": "TBA", "12": "TBA" },
    notes: [],
    ranks: { "8": [], "9": [], "10": [], "11": [], "12": [] },
    attendance: {}
};

const saveToCloud = () => set(ref(db, 'ccc_master_data'), currentData);

// Admin Global Functions
window.loadAdminStudents = () => {
    const tb = document.getElementById('adminStudentList');
    if(tb) tb.innerHTML = (currentData.students || []).map(s => `<tr><td>${s.name}</td><td>${s.class}th</td><td>${s.phone}</td><td>P:₹${s.fee.paid}<br>D:₹${s.fee.due}</td><td><button onclick="openFeeModal('${s.email}','${s.name}')" class="btn btn-outline">Edit Fee</button></td></tr>`).join('');
};

window.addNewStudent = () => {
    const n = prompt("Name:"), c = prompt("Class:"), e = prompt("Email:"), p = prompt("Phone:");
    if(n && c && e && p) {
        if(!currentData.students) currentData.students = [];
        currentData.students.push({ name:n, class:c, email:e.toLowerCase(), phone:p, fee:{paid:0, due:1500} });
        saveToCloud().then(() => alert("Student Added!"));
    }
};

window.loadAdminAttendance = () => {
    const tb = document.getElementById('adminAttendanceList');
    if(tb) tb.innerHTML = (currentData.students || []).map(s => `<tr><td>${s.name}</td><td>${s.class}th</td><td><select class="att-sel" data-email="${s.email}"><option value="P">P</option><option value="A">A</option></select></td></tr>`).join('');
};

window.saveAttendance = () => {
    const date = new Date().toLocaleDateString();
    const day = {}; document.querySelectorAll('.att-sel').forEach(s => day[s.dataset.email] = s.value);
    if(!currentData.attendance) currentData.attendance = {};
    currentData.attendance[date] = day; 
    saveToCloud().then(() => alert("Attendance Saved!"));
};

window.loadAdminTimetable = () => {
    const div = document.getElementById('adminTimetableList');
    if(div) div.innerHTML = Object.keys(currentData.timetable).map(cls => `<div class="form-group"><label>Class ${cls}th</label><input type="text" class="tt-in" data-class="${cls}" value="${currentData.timetable[cls]}"></div>`).join('');
};

window.saveTimetable = () => {
    document.querySelectorAll('.tt-in').forEach(i => currentData.timetable[i.dataset.class] = i.value);
    saveToCloud().then(() => alert("Timetable Updated!"));
};

window.loadRanksForClass = () => {
    const cls = document.getElementById('rankClassSelect').value;
    const rDiv = document.getElementById('rankInputs');
    if(!rDiv) return;
    const existing = currentData.ranks[cls] || [];
    let html = "";
    for(let i=0; i<5; i++) {
        const r = existing[i] || {name: "", score: ""};
        html += `<div class="form-row"><div class="form-group"><input type="text" class="rn-n" placeholder="Name" value="${r.name}"></div><div class="form-group"><input type="number" class="rn-s" placeholder="Score" value="${r.score}"></div></div>`;
    }
    rDiv.innerHTML = html;
};

window.saveRanks = () => {
    const cls = document.getElementById('rankClassSelect').value;
    const r = []; document.querySelectorAll('#rankInputs .form-row').forEach(row => { 
        const name = row.querySelector('.rn-n').value;
        const score = row.querySelector('.rn-s').value;
        if(name) r.push({name, score});
    });
    currentData.ranks[cls] = r; 
    saveToCloud().then(() => alert("Ranks Saved!"));
};

let editEmail = "";
window.openFeeModal = (email, name) => {
    editEmail = email; const s = currentData.students.find(x => x.email === email);
    if(s) {
        document.getElementById('feeStudentName').textContent = name;
        document.getElementById('feePaidInput').value = s.fee.paid;
        document.getElementById('feeDueInput').value = s.fee.due;
        document.getElementById('feeModal').style.display = 'flex';
    }
};
window.closeFeeModal = () => document.getElementById('feeModal').style.display = 'none';

window.confirmFeeUpdate = () => {
    const s = currentData.students.find(x => x.email === editEmail);
    if(s) {
        s.fee.paid = document.getElementById('feePaidInput').value;
        s.fee.due = document.getElementById('feeDueInput').value;
        saveToCloud().then(() => {
            document.getElementById('feeModal').style.display = 'none'; 
            alert("Fee Updated!");
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const isLoginPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('admin-login.html');
    const isAdminPage = window.location.pathname.includes('admin.html');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const isAdmin = localStorage.getItem('isAdmin');

    if (isAdminPage && (!isLoggedIn || !isAdmin)) {
        window.location.href = 'admin-login.html'; return;
    }
    if (!isLoggedIn && !isLoginPage) {
        window.location.href = 'login.html'; return;
    }

    // Load Realtime Data
    onValue(ref(db, 'ccc_master_data'), (snapshot) => {
        const val = snapshot.val();
        if(val) currentData = val;
        
        // Ensure default structures exist
        if(!currentData.students) currentData.students = [];
        if(!currentData.timetable) currentData.timetable = { "8": "TBA", "9": "TBA", "10": "TBA", "11": "TBA", "12": "TBA" };
        if(!currentData.notes) currentData.notes = [];
        if(!currentData.ranks) currentData.ranks = { "8": [], "9": [], "10": [], "11": [], "12": [] };
        if(!currentData.attendance) currentData.attendance = {};

        if (isLoginPage) handleLoginPage();
        else if (isAdminPage) handleAdminPage();
        else handleStudentDashboard();
    });

    function handleLoginPage() {
        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const pass = document.getElementById('password').value;
            const user = (currentData.students || []).find(s => s.email.toLowerCase() === email && s.phone === pass);
            
            if (user) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userEmail', email);
                localStorage.setItem('userName', user.name);
                localStorage.setItem('userClass', user.class);
                localStorage.setItem('isAdmin', 'false');
                window.location.href = 'index.html';
            } else {
                alert("Invalid Login!");
            }
        });
    }

    function handleStudentDashboard() {
        const uClass = localStorage.getItem('userClass');
        const uEmail = localStorage.getItem('userEmail');
        document.getElementById('displayUsername').textContent = localStorage.getItem('userName');
        document.getElementById('displayHandle').textContent = `Class ${uClass}th | ${uEmail}`;

        const timetable = currentData.timetable || {};
        if(document.getElementById('studentTimetable')) 
            document.getElementById('studentTimetable').innerHTML = `<div class="time-card grade-${uClass}"><div class="class-title">Class ${uClass}th</div><div class="class-time">${timetable[uClass] || 'TBA'}</div></div>`;

        const attBody = document.getElementById('studentAttendanceBody');
        if(attBody) {
            attBody.innerHTML = "";
            Object.keys(currentData.attendance || {}).forEach(date => {
                const day = currentData.attendance[date];
                if(day && day[uEmail]) {
                    const status = day[uEmail];
                    attBody.innerHTML += `<tr><td>${date}</td><td><span class="status-pill ${status==='P'?'present':'absent'}">${status}</span></td><td>Regular Session</td></tr>`;
                }
            });
        }

        const s = (currentData.students || []).find(x => x.email.toLowerCase() === uEmail);
        if(document.getElementById('studentFeeBody') && s) 
            document.getElementById('studentFeeBody').innerHTML = `<tr><td>Paid</td><td>₹${s.fee.paid}</td></tr><tr><td>Due</td><td style="color:red">₹${s.fee.due}</td></tr>`;

        const nList = document.getElementById('studentNotesList');
        if(nList) {
            nList.innerHTML = "";
            (currentData.notes || []).filter(n => n.class === uClass).forEach(n => {
                nList.innerHTML += `<div class="note-item"><span>${n.title}</span><a href="#" class="download-link" onclick="downloadNoteFile('${n.title}')"><i class="fas fa-download"></i></a></div>`;
            });
        }
        
        const rnk = document.getElementById('studentRankings');
        if(rnk && currentData.ranks && currentData.ranks[uClass]) {
            const data = currentData.ranks[uClass];
            if(data.length > 0) {
                rnk.innerHTML = `<div class="ranking-card">${data.map((r,i)=>`<div class="rank-item"><div class="rank-num">${i+1}</div><div class="rank-details"><div class="rank-name">${r.name}</div><div class="rank-points">${r.score} marks</div></div></div>`).join('')}</div>`;
            }
        }
    }

    function handleAdminPage() {
        window.loadAdminStudents();
        window.loadAdminAttendance();
        window.loadAdminTimetable();
        window.loadRanksForClass();

        const noteForm = document.getElementById('uploadNoteForm');
        if(noteForm && !noteForm.hasListener) {
            noteForm.addEventListener('submit', (e)=>{
                e.preventDefault();
                if(!currentData.notes) currentData.notes = [];
                currentData.notes.push({title:document.getElementById('noteTitle').value, class:document.getElementById('noteClass').value});
                saveToCloud().then(() => { alert("Note Added!"); e.target.reset(); });
            });
            noteForm.hasListener = true;
        }
    }

    document.getElementById('logoutBtn')?.addEventListener('click', () => { localStorage.clear(); window.location.href = 'login.html'; });
});

// Globals for HTML onclick
window.togglePasswordVisibility = (id, icon) => {
    const i = document.getElementById(id);
    if(i) {
        i.type = i.type === "password" ? "text" : "password";
        icon.classList.toggle('fa-eye'); icon.classList.toggle('fa-eye-slash');
    }
};
window.downloadNoteFile = (name) => {
    const blob = new Blob([`Material: ${name}\nCCC Coaching`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${name}.txt`;
    a.click();
};
