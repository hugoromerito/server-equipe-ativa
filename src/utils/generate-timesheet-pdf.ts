import PDFDocument from 'pdfkit'
import type { Readable } from 'node:stream'

interface TimesheetData {
  organization: {
    name: string
    cnpj?: string
    address?: string
  }
  member: {
    name: string
    cpf?: string
    jobTitle?: string
    admissionDate?: string
    workingDays?: string[] // ['SEGUNDA', 'TERCA', etc]
  }
  schedule: {
    workDays: string // Ex: "SEG. A SEXTA-FEIRA"
    entryTime: string // Ex: "08:00h"
    exitTime: string // Ex: "17:30h"
    intervalStart: string // Ex: "12:00h"
    intervalEnd: string // Ex: "13:00h"
  }
  month: number // 1-12
  year: number
}

/**
 * Gera um PDF de folha de ponto mensal para um membro
 */
export function generateTimesheetPDF(data: TimesheetData): Readable {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
  })

  // Configurações
  const pageWidth = doc.page.width - 80 // margens
  const monthName = getMonthName(data.month)
  const daysInMonth = getDaysInMonth(data.month, data.year)

  // Cabeçalho - Empresa
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(`EMPRESA: ${data.organization.name}`, { align: 'left' })

  if (data.organization.cnpj) {
    doc.text(` | CNPJ: ${data.organization.cnpj}`, { continued: true })
  }

  if (data.organization.address) {
    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`ENDEREÇO: ${data.organization.address}`, { align: 'left' })
  }

  doc.moveDown(0.5)

  // Informações do Empregado
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(`EMPREGADO(A): ${data.member.name}`, { align: 'left' })

  let employeeInfo = ''
  if (data.member.jobTitle) {
    employeeInfo += `FUNÇÃO: ${data.member.jobTitle}`
  }
  if (data.member.cpf) {
    employeeInfo += ` | CPF: ${data.member.cpf}`
  }
  if (data.member.admissionDate) {
    employeeInfo += ` | DATA DE ADMISSÃO: ${data.member.admissionDate}`
  }

  if (employeeInfo) {
    doc.fontSize(9).font('Helvetica').text(employeeInfo, { align: 'left' })
  }

  doc.moveDown(0.5)

  // Horário de Trabalho
  const scheduleText = `HORÁRIO DE TRABALHO: ${data.schedule.workDays} DAS ${data.schedule.entryTime} às ${data.schedule.exitTime} / INTERVALO ${data.schedule.intervalStart} ÀS ${data.schedule.intervalEnd}`
  doc.fontSize(9).font('Helvetica').text(scheduleText, { align: 'left' })

  doc.moveDown(0.8)

  // Título do Mês
  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(`Ponto do mês de ${monthName} de ${data.year}`, { align: 'center' })

  doc.moveDown(0.8)

  // Tabela - Cabeçalho
  const tableTop = doc.y
  const colWidths = {
    date: 50,
    entry: 60,
    intervalExit: 60,
    intervalEntry: 60,
    exit: 60,
    signature: pageWidth - 350,
  }

  // Desenhar linha superior da tabela
  doc
    .strokeColor('#000000')
    .lineWidth(1)
    .moveTo(40, tableTop)
    .lineTo(40 + pageWidth, tableTop)
    .stroke()

  // Cabeçalho da tabela
  let currentX = 40
  const headerY = tableTop + 5

  doc.fontSize(9).font('Helvetica-Bold')

  // DATA
  doc.text('DATA', currentX + 5, headerY, {
    width: colWidths.date,
    align: 'center',
  })
  currentX += colWidths.date

  // ENTRADA
  doc.text('ENTRADA', currentX + 5, headerY, {
    width: colWidths.entry,
    align: 'center',
  })
  currentX += colWidths.entry

  // INTERVALO (título que abrange 2 colunas)
  doc.text('INTERVALO', currentX + 5, headerY, {
    width: colWidths.intervalExit + colWidths.intervalEntry,
    align: 'center',
  })

  // Segunda linha do cabeçalho - SAÍDA e ENTRADA do intervalo
  const subHeaderY = headerY + 12
  doc.fontSize(8)
  doc.text('SAÍDA', currentX + 5, subHeaderY, {
    width: colWidths.intervalExit,
    align: 'center',
  })
  currentX += colWidths.intervalExit

  doc.text('ENTRADA', currentX + 5, subHeaderY, {
    width: colWidths.intervalEntry,
    align: 'center',
  })
  currentX += colWidths.intervalEntry

  // SAÍDA
  doc.fontSize(9)
  doc.text('SAÍDA', currentX + 5, headerY, {
    width: colWidths.exit,
    align: 'center',
  })
  currentX += colWidths.exit

  // ASSINATURA
  doc.text('ASSINATURA', currentX + 5, headerY, {
    width: colWidths.signature,
    align: 'center',
  })

  // Linha após cabeçalho
  const afterHeaderY = subHeaderY + 12
  doc
    .moveTo(40, afterHeaderY)
    .lineTo(40 + pageWidth, afterHeaderY)
    .stroke()

  // Desenhar linhas verticais do cabeçalho
  drawVerticalLines(doc, tableTop, afterHeaderY, colWidths)

  // Corpo da tabela - Dias do mês
  let rowY = afterHeaderY
  const rowHeight = 22

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(data.year, data.month - 1, day)
    const dayOfWeek = date.getDay() // 0 = Domingo, 6 = Sábado
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Se for final de semana, preencher com fundo cinza
    if (isWeekend) {
      doc
        .rect(40, rowY, pageWidth, rowHeight)
        .fillAndStroke('#E0E0E0', '#000000')
    }

    rowY += 2

    currentX = 40
    doc.fontSize(9).font('Helvetica').fillColor('#000000')

    // Data
    const dateStr = `${day.toString().padStart(2, '0')}/${data.month.toString().padStart(2, '0')}`
    doc.text(dateStr, currentX + 5, rowY, {
      width: colWidths.date,
      align: 'center',
    })
    currentX += colWidths.date

    if (!isWeekend) {
      // ENTRADA
      doc.text(data.schedule.entryTime, currentX + 5, rowY, {
        width: colWidths.entry,
        align: 'center',
      })
      currentX += colWidths.entry

      // INTERVALO - SAÍDA
      doc.text(data.schedule.intervalStart, currentX + 5, rowY, {
        width: colWidths.intervalExit,
        align: 'center',
      })
      currentX += colWidths.intervalExit

      // INTERVALO - ENTRADA
      doc.text(data.schedule.intervalEnd, currentX + 5, rowY, {
        width: colWidths.intervalEntry,
        align: 'center',
      })
      currentX += colWidths.intervalEntry

      // SAÍDA
      doc.text(data.schedule.exitTime, currentX + 5, rowY, {
        width: colWidths.exit,
        align: 'center',
      })
      currentX += colWidths.exit

      // ASSINATURA (linha para assinar)
      doc.text('_______________', currentX + 10, rowY, {
        width: colWidths.signature,
        align: 'center',
      })
    } else {
      // Texto indicando final de semana
      currentX += colWidths.entry
      doc.fontSize(8).fillColor('#666666')
      const weekendText = dayOfWeek === 0 ? 'DOMINGO' : 'SÁBADO'
      doc.text(weekendText, currentX + 5, rowY + 3, {
        width:
          colWidths.intervalExit +
          colWidths.intervalEntry +
          colWidths.exit +
          colWidths.signature,
        align: 'center',
      })
      doc.fillColor('#000000').fontSize(9)
    }

    rowY += rowHeight - 2

    // Linha horizontal
    doc
      .strokeColor('#000000')
      .moveTo(40, rowY)
      .lineTo(40 + pageWidth, rowY)
      .stroke()

    // Linhas verticais
    if (!isWeekend) {
      drawVerticalLines(doc, rowY - rowHeight, rowY, colWidths)
    } else {
      // Apenas linha da coluna de data para finais de semana
      doc
        .moveTo(40 + colWidths.date, rowY - rowHeight)
        .lineTo(40 + colWidths.date, rowY)
        .stroke()
    }

    // Verificar se precisa de nova página
    if (rowY > doc.page.height - 100 && day < daysInMonth) {
      doc.addPage()
      rowY = 40
    }
  }

  // Rodapé
  doc.moveDown(2)
  doc
    .fontSize(8)
    .font('Helvetica')
    .text(
      'Declaro serem verdadeiras as informações acima.',
      40,
      doc.page.height - 80,
      {
        align: 'center',
      }
    )

  doc.moveDown(1)
  doc.text('_____________________________', { align: 'center' })
  doc.text('Assinatura do Empregado', { align: 'center' })

  doc.end()

  return doc as unknown as Readable
}

/**
 * Desenha as linhas verticais da tabela
 */
function drawVerticalLines(
  doc: PDFKit.PDFDocument,
  startY: number,
  endY: number,
  colWidths: Record<string, number>
) {
  let x = 40

  // Linha inicial (borda esquerda)
  doc.moveTo(x, startY).lineTo(x, endY).stroke()

  // Linha após DATA
  x += colWidths.date
  doc.moveTo(x, startY).lineTo(x, endY).stroke()

  // Linha após ENTRADA
  x += colWidths.entry
  doc.moveTo(x, startY).lineTo(x, endY).stroke()

  // Linha após INTERVALO - SAÍDA
  x += colWidths.intervalExit
  doc.moveTo(x, startY).lineTo(x, endY).stroke()

  // Linha após INTERVALO - ENTRADA
  x += colWidths.intervalEntry
  doc.moveTo(x, startY).lineTo(x, endY).stroke()

  // Linha após SAÍDA
  x += colWidths.exit
  doc.moveTo(x, startY).lineTo(x, endY).stroke()

  // Linha final (borda direita)
  x += colWidths.signature
  doc.moveTo(x, startY).lineTo(x, endY).stroke()
}

/**
 * Retorna o nome do mês em português
 */
function getMonthName(month: number): string {
  const months = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]
  return months[month - 1]
}

/**
 * Retorna o número de dias no mês
 */
function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}
