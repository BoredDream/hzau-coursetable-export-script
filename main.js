(function () {
  console.log("=== 正在启动：含任课老师补全的课表提取程序 ===");

  // 1. 基础配置
  const TERM_START = new Date('2026-03-02'); 
  const START_TIMES = {
    1: "08:00", 2: "08:55", 3: "10:00", 4: "10:55",
    5: "14:30", 6: "15:25", 7: "16:30", 8: "17:25",
    9: "19:00", 10: "19:50", 11: "20:40", 12: "21:30"
  };
  const END_TIMES = {
    1: "08:45", 2: "09:40", 3: "10:45", 4: "11:40",
    5: "15:15", 6: "16:10", 7: "17:15", 8: "18:10",
    9: "19:45", 10: "20:35", 11: "21:25", 12: "22:15"
  };

  const table = document.querySelector('.schedule-table table');
  if (!table) {
    console.error("❌ 未找到课表表格，请检查 iframe 环境。");
    return;
  }

  // --- 第一步：收集所有唯一的课程名称 ---
  const uniqueCourseNames = new Set();
  const allCourseItems = document.querySelectorAll('.course-item');
  allCourseItems.forEach(item => {
    const name = (item.querySelector('.name span:last-child') || item.querySelector('.name')).innerText.trim();
    if (name && name !== '未识别') uniqueCourseNames.add(name);
  });

  // --- 第二步：人工填写老师名称 ---
  const teacherMap = {};
  console.log(`📝 发现 ${uniqueCourseNames.size} 门不同课程，请在弹窗中填写老师。`);
  uniqueCourseNames.forEach(course => {
    const teacher = prompt(`请输入课程【${course}】的任课老师名字：\n（若不清楚可直接按确定留空）`, "");
    teacherMap[course] = teacher ? teacher.trim() : "";
  });

  const finalRecords = [];
  const rows = [...table.querySelectorAll('tr')].slice(1);

  // --- 第三步：深度解析并合并老师信息 ---
  rows.forEach((tr) => {
    const cells = tr.querySelectorAll('td');
    cells.forEach((td, colIndex) => {
      if (colIndex === 0) return;
      const weekday = colIndex;

      const items = td.querySelectorAll('.course-item');
      items.forEach((item) => {
        const name = (item.querySelector('.name span:last-child') || item.querySelector('.name')).innerText.trim();
        const timeText = item.querySelector('.el-icon-time + span')?.innerText.trim() || '';
        const location = item.querySelector('.el-icon-location-outline + span')?.innerText.trim() || '';
        const teacherName = teacherMap[name] || "";

        const secMatch = timeText.match(/[（\(](\d+)-?(\d*)节[）\)]/);
        if (!secMatch) return;
        const startSec = parseInt(secMatch[1]);
        const endSec = secMatch[2] ? parseInt(secMatch[2]) : startSec;

        const weekPart = timeText.replace(/^[（\(].*?节[）\)]\s*/, '');
        const segments = weekPart.split(/[,，]/);

        segments.forEach(seg => {
          let parity = 0;
          if (seg.includes('单')) parity = 1;
          if (seg.includes('双')) parity = 2;

          const rangeMatch = seg.match(/(\d+)-?(\d*)/);
          if (!rangeMatch) return;
          const startW = parseInt(rangeMatch[1]);
          const endW = rangeMatch[2] ? parseInt(rangeMatch[2]) : startW;

          for (let w = startW; w <= endW; w++) {
            if (parity === 1 && w % 2 === 0) continue;
            if (parity === 2 && w % 2 !== 0) continue;

            let d = new Date(TERM_START);
            d.setDate(TERM_START.getDate() + (w - 1) * 7 + (weekday - 1));
            const dateRaw = d.toISOString().split('T')[0];

            // 格式：课程名 (老师名字)
            const fullSubject = teacherName ? `${name} (${teacherName})` : name;

            finalRecords.push({
              Subject: fullSubject,
              StartDate: d,
              DateRaw: dateRaw,
              StartT: START_TIMES[startSec],
              EndT: END_TIMES[endSec],
              Location: location,
              Description: `第${w}周 | 教师: ${teacherName || '未填写'}`
            });
          }
        });
      });
    });
  });

  // --- 第四步：构建 HTML 预览与多格式导出 ---
  const container = document.createElement('div');
  container.style = "position:fixed;top:5%;left:5%;width:90%;height:90%;background:white;z-index:99999;overflow:auto;border:3px solid #007131;padding:25px;box-shadow:0 0 20px rgba(0,0,0,0.3);font-family:sans-serif;border-radius:8px;";
  
  let html = `<h2 style="color:#007131">课表解析成功 (含老师信息，共 ${finalRecords.length} 条记录)</h2>`;
  html += `<div style="margin-bottom:15px;">
             <button id="dlCSV" style="padding:10px 15px;background:#4CAF50;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">导出为 CSV (Google日历)</button>
             <button id="dlICS" style="margin-left:10px;padding:10px 15px;background:#2196F3;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">导出为 ICS (通用格式)</button>
             <button id="closeM" style="margin-left:10px;padding:10px 15px;background:#9e9e9e;color:white;border:none;border-radius:4px;cursor:pointer;">关闭预览</button>
           </div>`;
  html += `<table border="1" style="width:100%;border-collapse:collapse;font-size:13px;"><tr style="background:#f2f2f2"><th>课程(老师)</th><th>日期</th><th>时间</th><th>地点</th><th>备注</th></tr>`;
  finalRecords.forEach(r => {
    html += `<tr><td style="padding:5px">${r.Subject}</td><td>${r.DateRaw}</td><td>${r.StartT}-${r.EndT}</td><td>${r.Location}</td><td>${r.Description}</td></tr>`;
  });
  html += `</table>`;
  container.innerHTML = html;
  document.body.appendChild(container);

  // 导出逻辑
  const formatDateICS = (date, timeStr) => {
    const [hh, mm] = timeStr.split(':');
    const d = new Date(date);
    d.setHours(hh, mm, 0);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  document.getElementById('dlCSV').onclick = () => {
    let csv = "\ufeffSubject,Start Date,Start Time,End Date,End Time,Location,Description\n";
    finalRecords.forEach(r => {
      csv += `"${r.Subject}","${r.DateRaw}","${r.StartT}","${r.DateRaw}","${r.EndT}","${r.Location}","${r.Description}"\n`;
    });
    downloadFile(csv, "university_schedule_plus.csv", "text/csv");
  };

  document.getElementById('dlICS').onclick = () => {
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Gemini Schedule Exporter//CN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n";
    finalRecords.forEach(r => {
      ics += `BEGIN:VEVENT\nSUMMARY:${r.Subject}\nDTSTART:${formatDateICS(r.StartDate, r.StartT)}\nDTEND:${formatDateICS(r.StartDate, r.EndT)}\nLOCATION:${r.Location}\nDESCRIPTION:${r.Description}\nSTATUS:CONFIRMED\nSEQUENCE:0\nBEGIN:VALARM\nTRIGGER:-PT15M\nACTION:DISPLAY\nDESCRIPTION:Reminder\nEND:VALARM\nEND:VEVENT\n`;
    });
    ics += "END:VCALENDAR";
    downloadFile(ics, "university_schedule_plus.ics", "text/calendar");
  };

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  }
  document.getElementById('closeM').onclick = () => container.remove();
})();
