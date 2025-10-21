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
    margins: { top: 30, bottom: 30, left: 30, right: 30 },
  })

  // Configurações
  const pageWidth = doc.page.width - 60 // margens
  const monthName = getMonthName(data.month)
  const daysInMonth = getDaysInMonth(data.month, data.year)

  const startX = 30
  const startY = 30

  // ========== CAIXA 1: INFORMAÇÕES DA EMPRESA ==========
  const companyBoxHeight = 30
  doc
    .rect(startX, startY, pageWidth, companyBoxHeight)
    .stroke()

  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(
      `EMPRESA: ${data.organization.name}${data.organization.cnpj ? ` | CNPJ: ${data.organization.cnpj}` : ''}`,
      startX + 5,
      startY + 5,
      { width: pageWidth - 10, align: 'left' }
    )

  if (data.organization.address) {
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(`ENDEREÇO: ${data.organization.address}`, startX + 5, startY + 18, {
        width: pageWidth - 10,
        align: 'left',
      })
  }

  // ========== CAIXA 2: INFORMAÇÕES DO FUNCIONÁRIO ==========
  const employeeBoxY = startY + companyBoxHeight + 2
  const employeeBoxHeight = 40

  doc
    .rect(startX, employeeBoxY, pageWidth, employeeBoxHeight)
    .stroke()

  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(`EMPREGADO(A): ${data.member.name}`, startX + 5, employeeBoxY + 5, {
      width: pageWidth - 10,
      align: 'left',
    })

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
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(employeeInfo, startX + 5, employeeBoxY + 18, {
        width: pageWidth - 10,
        align: 'left',
      })
  }

  // Horário de Trabalho
  const scheduleText = `HORÁRIO DE TRABALHO: ${data.schedule.workDays} DAS ${data.schedule.entryTime} às ${data.schedule.exitTime} / INTERVALO ${data.schedule.intervalStart} ÀS ${data.schedule.intervalEnd}`
  doc
    .fontSize(8)
    .font('Helvetica')
    .text(scheduleText, startX + 5, employeeBoxY + 28, {
      width: pageWidth - 10,
      align: 'left',
    })

  // Espaçamento menor antes da tabela
  const tableStartY = employeeBoxY + employeeBoxHeight + 8

  // Título do Mês
  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(
      `Ponto do mês de ${monthName} de ${data.year}`,
      startX,
      tableStartY,
      { width: pageWidth, align: 'center' }
    )

  // Tabela - Cabeçalho
  const tableTop = tableStartY + 18
  const colWidths = {
    date: 45,
    entry: 55,
    intervalExit: 55,
    intervalEntry: 55,
    exit: 55,
    signature: pageWidth - 265,
  }

  // Desenhar linha superior da tabela
  doc
    .strokeColor('#000000')
    .lineWidth(1)
    .moveTo(startX, tableTop)
    .lineTo(startX + pageWidth, tableTop)
    .stroke()

  // Cabeçalho da tabela
  let currentX = startX
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
    .moveTo(startX, afterHeaderY)
    .lineTo(startX + pageWidth, afterHeaderY)
    .stroke()

  // Desenhar linhas verticais do cabeçalho
  drawVerticalLines(doc, tableTop, afterHeaderY, colWidths, startX)

  // Corpo da tabela - Dias do mês
  let rowY = afterHeaderY
  const rowHeight = 18 // Reduzido para caber tudo em uma página

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(data.year, data.month - 1, day)
    const dayOfWeek = date.getDay() // 0 = Domingo, 6 = Sábado
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Se for final de semana, preencher com fundo cinza
    if (isWeekend) {
      doc
        .rect(startX, rowY, pageWidth, rowHeight)
        .fillAndStroke('#E0E0E0', '#000000')
    }

    rowY += 2

    currentX = startX
    doc.fontSize(8).font('Helvetica').fillColor('#000000')

    // Data
    const dateStr = `${day.toString().padStart(2, '0')}/${data.month.toString().padStart(2, '0')}`
    doc.text(dateStr, currentX + 3, rowY, {
      width: colWidths.date,
      align: 'center',
    })
    currentX += colWidths.date

    if (!isWeekend) {
      // ENTRADA - DEIXAR EM BRANCO para preenchimento manual
      currentX += colWidths.entry

      // INTERVALO - SAÍDA - DEIXAR EM BRANCO
      currentX += colWidths.intervalExit

      // INTERVALO - ENTRADA - DEIXAR EM BRANCO
      currentX += colWidths.intervalEntry

      // SAÍDA - DEIXAR EM BRANCO
      currentX += colWidths.exit

      // ASSINATURA - DEIXAR EM BRANCO (sem linha, para assinatura manual)
      currentX += colWidths.signature
    } else {
      // Texto indicando final de semana
      currentX += colWidths.entry
      doc.fontSize(7).fillColor('#666666')
      const weekendText = dayOfWeek === 0 ? 'DOMINGO' : 'SÁBADO'
      doc.text(weekendText, currentX + 5, rowY + 2, {
        width:
          colWidths.intervalExit +
          colWidths.intervalEntry +
          colWidths.exit +
          colWidths.signature,
        align: 'center',
      })
      doc.fillColor('#000000').fontSize(8)
    }

    rowY += rowHeight - 2

    // Linha horizontal
    doc
      .strokeColor('#000000')
      .moveTo(startX, rowY)
      .lineTo(startX + pageWidth, rowY)
      .stroke()

    // Linhas verticais
    if (!isWeekend) {
      drawVerticalLines(doc, rowY - rowHeight, rowY, colWidths, startX)
    } else {
      // Apenas linha da coluna de data para finais de semana
      doc
        .moveTo(startX + colWidths.date, rowY - rowHeight)
        .lineTo(startX + colWidths.date, rowY)
        .stroke()
    }
  }

  // Rodapé
  doc.moveDown(1.5)
  doc
    .fontSize(8)
    .font('Helvetica')
    .text(
      'Declaro serem verdadeiras as informações acima.',
      startX,
      doc.page.height - 70,
      {
        width: pageWidth,
        align: 'center',
      }
    )

  doc.moveDown(1)
  doc.text('_____________________________', { width: pageWidth, align: 'center' })
  doc.text('Assinatura do Empregado', { width: pageWidth, align: 'center' })

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
  colWidths: Record<string, number>,
  startX: number
) {
  let x = startX

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
