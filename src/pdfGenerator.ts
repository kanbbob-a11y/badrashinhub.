import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Registration } from './types';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export function generatePDF(dayLabel: string, registrations: Registration[]) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.setFontSize(20);
  doc.setTextColor(30, 64, 175);
  doc.text('Roster Report', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text(dayLabel, doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);
  doc.text(`Total Registrations: ${registrations.length}`, doc.internal.pageSize.getWidth() / 2, 38, { align: 'center' });

  const longShift = registrations.filter((r) => r.shiftType === 'long');
  const nightShift = registrations.filter((r) => r.shiftType === 'night');
  const h24Shift = registrations.filter((r) => r.shiftType === '24');

  const shiftGroups = [
    { name: 'Long Shift', data: longShift, color: [245, 158, 11] as [number, number, number] },
    { name: 'Night Shift', data: nightShift, color: [99, 102, 241] as [number, number, number] },
    { name: '24h Shift', data: h24Shift, color: [239, 68, 68] as [number, number, number] },
  ];

  let startY = 45;

  shiftGroups.forEach((group) => {
    if (group.data.length === 0) return;

    const tableData = group.data.map((r, i) => [
      r.phone,
      r.employeeId,
      r.name,
      (i + 1).toString(),
    ]);

    doc.autoTable({
      startY,
      head: [['Phone', 'Employee ID', 'Name', '#']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: group.color,
        textColor: [255, 255, 255],
        fontSize: 11,
        halign: 'center',
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 10,
        halign: 'center',
        textColor: [50, 50, 50],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto',
    });

    doc.setFontSize(12);
    doc.setTextColor(group.color[0], group.color[1], group.color[2]);
    doc.text(`${group.name} (${group.data.length})`, doc.internal.pageSize.getWidth() / 2, startY - 2, { align: 'center' });

    startY = doc.lastAutoTable.finalY + 15;
  });

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleString('ar-EG')}`, doc.internal.pageSize.getWidth() / 2, pageHeight - 10, { align: 'center' });

  doc.save(`roster_${dayLabel.replace(/\s/g, '_')}.pdf`);
}
