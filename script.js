// Champaran Coaching Center - Unified Project Script
document.addEventListener('DOMContentLoaded', () => {
    const isLoginPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('admin-login.html');
    const isAdminPage = window.location.pathname.includes('admin.html');
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const isAdmin = localStorage.getItem('isAdmin');

    // Security
    if (isAdminPage && (!isLoggedIn || !isAdmin)) {
        window.location.href = 'admin-login.html';
        return;
    }
    if (!isLoggedIn && !isLoginPage) {
        window.location.href = 'login.html';
        return;
    }

    // Data Init
    if (!localStorage.getItem('ccc_master_data')) {
        const initialData = {
            students: [],
            timetable: { "8": "TBA", "9": "TBA", "10": "TBA", "11": "TBA", "12": "TBA" },
            notes: [],
            ranks: { "8": [], "9": [], "10": [], "11": [], "12": [] },
            attendance: {} 
        };
        localStorage.setItem('ccc_master_data', JSON.stringify(initialData));
    }
    const masterData = JSON.parse(localStorage.getItem('ccc_master_data'));

    function saveMasterData() {
        localStorage.setItem('ccc_master_data', JSON.stringify(masterData));
    }

    // Role Routing
    if (isLoginPage) handleLoginPage();
    else if (isAdminPage) handleAdminPage();
    else handleStudentDashboard();

    // --- STUDENT LOGIN ---
    function handleLoginPage() {
        const loginForm = document.getElementById('loginForm');
        loginForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = e.target.querySelector('button');
            btn.innerHTML = 'Authenticating...';
            
            setTimeout(() => {
                // Match email AND phone number (used as password)
                const user = masterData.students.find(s => s.email === email && s.phone === password);
                
                if (user) {
                    localStorage.setItem('isLoggedIn', 'true');
                    localStorage.setItem('userEmail', email);
                    localStorage.setItem('userName', user.name);
                    localStorage.setItem('userClass', user.class);
                    localStorage.setItem('isAdmin', 'false');
                    window.location.href = 'index.html';
                } else {
                    alert("Invalid Email or Password (Phone Number)! Please check with Sadam Sir.");
                    btn.innerHTML = 'Login to Dashboard';
                }
            }, 800);
        });
    }

    // --- STUDENT PANEL ---
    function handleStudentDashboard() {
        const userClass = localStorage.getItem('userClass');
        const userEmail = localStorage.getItem('userEmail');
        if (!userClass) return;

        document.getElementById('displayUsername').textContent = localStorage.getItem('userName');
        document.getElementById('displayHandle').textContent = `Class ${userClass}th | ${userEmail}`;

        // Timetable
        const tt = document.getElementById('studentTimetable');
        if(tt) tt.innerHTML = `<div class="time-card grade-${userClass}"><div class="class-title">Class ${userClass}th</div><div class="class-time">${masterData.timetable[userClass]}</div></div>`;

        // Attendance
        const att = document.getElementById('studentAttendanceBody');
        if(att) {
            att.innerHTML = "";
            Object.keys(masterData.attendance).forEach(date => {
                if(masterData.attendance[date][userEmail]) {
                    const status = masterData.attendance[date][userEmail];
                    att.innerHTML += `<tr><td>${date}</td><td><span class="status-pill ${status==='P'?'present':'absent'}">${status}</span></td><td>Regular Session</td></tr>`;
                }
            });
        }

        // Fee
        const fee = document.getElementById('studentFeeBody');
        const s = masterData.students.find(x => x.email === userEmail);
        if(fee && s) fee.innerHTML = `<tr><td>Paid</td><td>₹${s.fee.paid}</td></tr><tr><td>Due</td><td style="color:red">₹${s.fee.due}</td></tr>`;

        // Ranks
        const rnk = document.getElementById('studentRankings');
        const label = document.getElementById('rankClassLabel');
        if(label) label.textContent = `Class ${userClass}th`;
        if(rnk) {
            const data = masterData.ranks[userClass] || [];
            if(data.length > 0) {
                rnk.innerHTML = `<div class="ranking-card">${data.map((r,i)=>`<div class="rank-item"><div class="rank-num">${i+1}</div><div class="rank-details"><div class="rank-name">${r.name}</div><div class="rank-points">${r.score} marks</div></div></div>`).join('')}</div>`;
            }
        }

        // Notes
        const nts = document.getElementById('studentNotesList');
        if(nts) {
            const list = masterData.notes.filter(n => n.class === userClass);
            list.forEach(n => {
                nts.innerHTML += `<div class="note-item"><span>${n.title}</span><a href="#" class="download-link" onclick="downloadNoteFile('${n.title}')"><i class="fas fa-download"></i></a></div>`;
            });
        }
    }

    // --- ADMIN PANEL ---
    function handleAdminPage() {
        window.loadAdminStudents = () => {
            const tb = document.getElementById('adminStudentList');
            if(!tb) return;
            tb.innerHTML = masterData.students.map(s => `<tr><td>${s.name}</td><td>${s.class}th</td><td>${s.phone}</td><td>P:₹${s.fee.paid}<br>D:₹${s.fee.due}</td><td><button onclick="openFeeModal('${s.email}','${s.name}')" class="btn btn-outline">Edit Fee</button></td></tr>`).join('');
        };

        window.addNewStudent = () => {
            const n = prompt("Name:"), c = prompt("Class (8-12):"), e = prompt("Email:"), p = prompt("Phone:");
            if(n && c && e && p) {
                masterData.students.push({ name:n, class:c, email:e, phone:p, fee:{paid:0, due:1500} });
                saveMasterData(); loadAdminStudents(); alert("Added!");
            }
        };

        window.loadAdminAttendance = () => {
            const tb = document.getElementById('adminAttendanceList');
            if(!tb) return;
            tb.innerHTML = masterData.students.map(s => `<tr><td>${s.name}</td><td>${s.class}th</td><td><select class="att-sel" data-email="${s.email}"><option value="P">P</option><option value="A">A</option></select></td></tr>`).join('');
        };

        window.saveAttendance = () => {
            const date = new Date().toLocaleDateString();
            const day = {}; document.querySelectorAll('.att-sel').forEach(s => day[s.dataset.email] = s.value);
            masterData.attendance[date] = day; saveMasterData(); alert("Saved!");
        };

        window.loadAdminTimetable = () => {
            const c = document.getElementById('adminTimetableList');
            if(!c) return;
            c.innerHTML = Object.keys(masterData.timetable).map(cls => `<div class="form-group"><label>Class ${cls}th</label><input type="text" class="tt-in" data-class="${cls}" value="${masterData.timetable[cls]}"></div>`).join('');
        };
        window.saveTimetable = () => {
            document.querySelectorAll('.tt-in').forEach(i => masterData.timetable[i.dataset.class] = i.value);
            saveMasterData(); alert("Updated!");
        };

        window.loadRanksForClass = () => {
            const cls = document.getElementById('rankClassSelect').value;
            const c = document.getElementById('rankInputs');
            if(!c) return;
            const cur = masterData.ranks[cls] || [];
            c.innerHTML = [1,2,3].map(i => `<div style="display:flex;gap:5px;margin-bottom:5px"><input type="text" class="rn-n" placeholder="Name" value="${cur[i-1]?.name||''}" style="flex:2"><input type="number" class="rn-s" placeholder="Marks" value="${cur[i-1]?.score||''}" style="flex:1"></div>`).join('');
        };
        window.saveRanks = () => {
            const cls = document.getElementById('rankClassSelect').value;
            const r = []; document.querySelectorAll('.rn-n').forEach((n,i) => { if(n.value) r.push({name:n.value, score:document.querySelectorAll('.rn-s')[i].value}) });
            masterData.ranks[cls] = r; saveMasterData(); alert("Ranks Saved!");
        };

        document.getElementById('uploadNoteForm')?.addEventListener('submit', (e)=>{
            e.preventDefault();
            const t = document.getElementById('noteTitle').value, c = document.getElementById('noteClass').value;
            masterData.notes.push({title:t, class:c}); saveMasterData(); alert("Uploaded!"); e.target.reset();
        });

        let editEmail = "";
        window.openFeeModal = (email, name) => {
            editEmail = email; const s = masterData.students.find(x => x.email === email);
            document.getElementById('feeStudentName').textContent = name;
            document.getElementById('feePaidInput').value = s.fee.paid;
            document.getElementById('feeDueInput').value = s.fee.due;
            document.getElementById('feeModal').style.display = 'flex';
        };
        window.closeFeeModal = () => document.getElementById('feeModal').style.display = 'none';
        window.confirmFeeUpdate = () => {
            const s = masterData.students.find(x => x.email === editEmail);
            s.fee.paid = document.getElementById('feePaidInput').value;
            s.fee.due = document.getElementById('feeDueInput').value;
            saveMasterData(); closeFeeModal(); loadAdminStudents(); alert("Fee Updated!");
        };

        loadAdminStudents(); loadAdminAttendance(); loadAdminTimetable(); loadRanksForClass();
    }

    document.getElementById('logoutBtn')?.addEventListener('click', () => { localStorage.removeItem('isLoggedIn'); window.location.href = 'login.html'; });
});

// Helper: Toggle Password Visibility
function togglePasswordVisibility(inputId, icon) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = "password";
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function downloadNoteFile(name) {
    const blob = new Blob([`Study Material: ${name}\n\nChamparan Coaching Center.\nBy Sadam Sir.`], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `${name.replace(/\s+/g,'_')}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
