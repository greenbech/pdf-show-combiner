import {
  PDFDocument,
  rgb,
  StandardFonts,
} from 'https://cdn.skypack.dev/pdf-lib@^1.11.1?dts'
import { readCSV } from 'https://deno.land/x/csv/mod.ts'
import { expandGlob } from 'https://deno.land/std@0.88.0/fs/mod.ts'
import * as path from 'https://deno.land/std/path/mod.ts'
import { parse } from "https://deno.land/std@0.86.0/flags/mod.ts";

interface DocumentInformation {
  pdfPath?: string
  donorPdf?: string
  tempo?: string
  cue?: string
  patch?: string
  endNote?: string
}

interface CsvData {
  type: string
  folderName: string
  priorAct: string
  nickName: string
  cue: string
  globalEndNote: string
  tempo: string
  startingPerformer: string
  performerFileNames: Array<string>
  performerPatch: string
  performerEndNote: string
}

async function extractCsvDatas(
  performer: string,
  csvPath: string,
): Promise<CsvData[]> {
  const f = await Deno.open(csvPath)

  let rowIndex = 0
  let performerIndex = undefined
  const csvDatas: Array<CsvData> = []
  for await (const row of readCSV(f, { columnSeparator: '\t' })) {
    if (rowIndex == 0) {
      let columnIndex = 0
      for await (const cell of row) {
        if (cell == performer) {
          performerIndex = columnIndex
        }
        columnIndex += 1
      }
    } else if (rowIndex == 1) {
      //pass
    } else if (rowIndex > 1) {
      if (performerIndex == undefined) {
        throw new Error(
          `Did not find performer ${performer} in file ${csvPath}`,
        )
      }

      let type = undefined
      let folderName = undefined
      let priorAct = undefined
      let nickName = undefined
      let cue = undefined
      let globalEndNote = undefined
      let tempo = undefined
      let startingPerformer = undefined
      let performerFileNames = undefined
      let performerPatch = undefined
      let performerEndNote = undefined

      let columnIndex = 0
      for await (const cell of row) {
        switch (columnIndex) {
          case 0:
            type = cell
            break
          case 1:
            folderName = cell
            break
          case 2:
            priorAct = cell
            break
          case 3:
            nickName = cell
            break
          case 4:
            cue = cell
            break
          case 5:
            globalEndNote = cell
            break
          case 6:
            tempo = cell
            break
          case 7:
            startingPerformer = cell
            break
          case performerIndex:
            performerFileNames = cell.split('|').filter(Boolean)
            break
          case performerIndex + 1:
            performerPatch = cell
            break
          case performerIndex + 2:
            performerEndNote = cell
            break
        }
        columnIndex += 1
      }

      if (
        type == undefined ||
        folderName == undefined ||
        priorAct == undefined ||
        nickName == undefined ||
        cue == undefined ||
        globalEndNote == undefined ||
        tempo == undefined ||
        startingPerformer == undefined ||
        performerFileNames == undefined ||
        performerFileNames.length == 0 ||
        performerPatch == undefined ||
        performerEndNote == undefined
      ) {
        console.log(folderName)

        console.log(performerFileNames)

        throw new Error(
          `Failed to parse CSV file ${csvPath}. Is every field present for performer "${performer}"?`,
        )
      }

      csvDatas.push({
        type: type,
        folderName: folderName,
        priorAct: priorAct,
        nickName: nickName,
        cue: cue,
        globalEndNote: globalEndNote,
        tempo: tempo,
        startingPerformer: startingPerformer,
        performerFileNames: performerFileNames,
        performerPatch: performerPatch,
        performerEndNote: performerEndNote,
      })
    }
    rowIndex += 1
  }
  return csvDatas
}

interface extractDocumentOptions {
  performer: string
  csvDatas: Array<CsvData>
  folderPath: string
}

async function extractDocumentInformations(
  options: extractDocumentOptions,
): Promise<DocumentInformation[]> {
  const folderPath = options.folderPath
  const csvDatas = options.csvDatas
  const performer = options.performer
  const documentInformations: Array<DocumentInformation> = []

  for (const csvData of csvDatas) {
    // Performer does not play on piece
    if (
      csvData.performerFileNames.length == 1 &&
      csvData.performerFileNames[0] == '-'
    ) {
      // Only retrieve the first page of the PDF file with shortest name
      const allFilePaths = []
      for await (const entry of expandGlob(
        `${folderPath}/${csvData.type}/${csvData.folderName}/**/*.pdf`,
      )) {
        allFilePaths.push(entry.path)
      }

      if (allFilePaths.length == 0) {
        throw new Error(
          `Did not find any PDF files for song ${csvData.type}/${csvData.folderName}`,
        )
      }

      const chosenPdf = allFilePaths.reduce((a, b) =>
        a.length <= b.length ? a : b,
      )

      documentInformations.push({
        donorPdf: chosenPdf,
        cue: `${csvData.startingPerformer} "${csvData.cue}"`.trim(),
        tempo: csvData.tempo,
        patch: csvData.performerPatch,
        endNote: csvData.performerEndNote || csvData.globalEndNote,
      })
    } else {
      // Find PDF file for performer
      const allFilePaths = []
      for await (const entry of expandGlob(
        `${folderPath}/${csvData.type}/${csvData.folderName}/**/*.pdf`,
      )) {
        allFilePaths.push(entry.path)
      }

      if (allFilePaths.length == 0) { 
        throw new Error(
          `Did not find any PDF files for song ${csvData.type}/${csvData.folderName}`,
        )
      }

      const possiblePdfPaths = []
      for (const pdfPath of allFilePaths) {
        let isMatch = false
        let isNotMatch = false
        for (const possibleSubstring of csvData.performerFileNames) {
          if (
            possibleSubstring.startsWith('^') &&
            path
              .basename(pdfPath)
              .toLowerCase()
              .includes(possibleSubstring.substring(1).toLowerCase())
          ) {
            isNotMatch = true
            break
          }
          if (
            path
              .basename(pdfPath)
              .toLowerCase()
              .includes(possibleSubstring.toLowerCase())
          ) {
            isMatch = true
          }
        }
        if (isMatch && !isNotMatch) {
          possiblePdfPaths.push(pdfPath)
        }
      }

      if (possiblePdfPaths.length == 0) {
        const baseNames = allFilePaths.map((filePath) =>
          path.basename(filePath).toLowerCase(),
        )
        console.log(`All PDFs for song is: ${baseNames}`)

        throw new Error(
          `Did not find any PDFs for performer ${performer} for song ${csvData.type}/${csvData.folderName} with file names ${csvData.performerFileNames}`,
        )
      }
      let chosenPdf = undefined
      if (possiblePdfPaths.length > 1) {
        console.log(
          `Found ${possiblePdfPaths.length} PDFs for performer ${performer} for song ${csvData.type}/${csvData.folderName}`,
        )
        console.log(`Matching PDFs: ${possiblePdfPaths}`)

        // Choose the longest PDF path
        chosenPdf = possiblePdfPaths.reduce((a, b) =>
          a.length > b.length ? a : b,
        )
      } else {
        chosenPdf = possiblePdfPaths[0]
      }
      console.log(`Chosen PDF: ${chosenPdf}`)
      documentInformations.push({
        pdfPath: chosenPdf,
        cue: `${csvData.startingPerformer} "${csvData.cue}"`.trim(),
        tempo: csvData.tempo,
        patch: csvData.performerPatch,
        endNote: csvData.performerEndNote || csvData.globalEndNote,
      })
    }
  }

  return documentInformations
}

async function combineDocuments(
  performer: string,
  documentInformations: Array<DocumentInformation>,
) {
  // Create a new PDFDocument that will be the combined PDF
  const dstDoc = await PDFDocument.create()
  const fontSize = 13
  const helvetica = await dstDoc.embedFont(StandardFonts.Helvetica)
  const timesRomanItalic = await dstDoc.embedFont(
    StandardFonts.TimesRomanItalic,
  )
  const timesRoman = await dstDoc.embedFont(StandardFonts.TimesRoman)

  const tempoColor = rgb(0.0, 0.0, 0.0)
  const cueColor = rgb(0.8, 0.2, 0.2)
  const patchColor = rgb(0.2, 0.2, 0.5)
  const endNoteColor = rgb(0.2, 0.5, 0.2)

  for (const docInfo of documentInformations) {
    // Read PDF from memory and load it as a PDFDocument type
    let donorPdf = undefined
    let totalPages = undefined
    if (docInfo.pdfPath) {
      donorPdf = await PDFDocument.load(Deno.readFileSync(docInfo.pdfPath))
      totalPages = donorPdf.getPageCount()
    } else if (docInfo.donorPdf) {
      donorPdf = await PDFDocument.load(Deno.readFileSync(docInfo.donorPdf))
      totalPages = 1
      // totalPages = donorPdf.getPageCount()
    } else {
      throw Error(
        'Did not find PDF path. This is probably an error with this script.',
      )
    }

    for (let i = 0; i < totalPages; i++) {
      const [page] = await dstDoc.copyPages(donorPdf, [i])

      if (i == 0) {
        if (docInfo.tempo) {
          const { width, height } = page.getSize()
          page.drawText(`tempo: ${docInfo.tempo}`, {
            x: 0.1 * width,
            y: 0.96 * height,
            size: fontSize,
            font: timesRoman,
            color: tempoColor,
          })
        }
        if (docInfo.cue) {
          const { width, height } = page.getSize()
          page.drawText(docInfo.cue, {
            x: 0.1 * width,
            y: 0.98 * height,
            size: fontSize + 1,
            font: timesRomanItalic,
            color: cueColor,
          })
        }
        if (docInfo.patch) {
          const { width, height } = page.getSize()
          page.drawText(docInfo.patch, {
            x: 0.7 * width,
            y: 0.98 * height,
            size: fontSize,
            font: helvetica,
            color: patchColor,
          })
        }
      }
      if (i == totalPages - 1) {
        if (docInfo.endNote) {
          const { width, height } = page.getSize()
          page.drawText(docInfo.endNote, {
            x: 0.7 * width,
            y: (1 - 0.98) * height,
            size: fontSize,
            font: helvetica,
            color: endNoteColor,
          })
        }
      }

      dstDoc.addPage(page)
    }
  }

  // Serialize the PDFDocument to bytes (a Uint8Array)
  const pdfBytes = await dstDoc.save()
  Deno.writeFileSync(`${performer}.pdf`, pdfBytes)
}

async function main() {
  const args = parse(Deno.args);


  // const performer = "Henrik"
  const csvPath = args.csv
  const songsDirectory = args.folder
  const performers = [args.performer]
  for (const performer of performers) {
    console.log(`Parsing performer ${performer}`)

    const csvDatas = await extractCsvDatas(performer, csvPath)
    const documentInformations = await extractDocumentInformations({
      performer: performer,
      folderPath: songsDirectory,
      csvDatas: csvDatas,
    })
    combineDocuments(performer, documentInformations)
  }
}

main()
