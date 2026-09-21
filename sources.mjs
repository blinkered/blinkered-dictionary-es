/**
 * The collections that attest Spanish, and where each comes from.
 *
 * The only language-specific file in this repository. How to read a collection lives in
 * `@blinkered/attestation`; what lives here is which collections, and why those.
 *
 * Chosen for **family** as much as for volume. Three collections gathered by one organization
 * are one opinion, so what matters is how many genuinely separate gatherers a word can be found
 * by: a wiki, a newspaper crawler, a shelf of books, a sentence bank, a translation, the crawled
 * web, and any site we fetch ourselves.
 */

import { createReadStream, existsSync, readFileSync, readdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import {
  fileDocuments,
  fineweb2Documents,
  gutenbergBody,
  harvestDocuments,
  leipzigLocators,
  leipzigSentences,
  tatoebaDocuments,
  verseDocuments,
  wikiDocuments,
} from '@blinkered/attestation'

export const LANGUAGE = 'es'

const CACHE = new URL('.cache/raw/', import.meta.url).pathname

/** A Leipzig package, with its sentence-to-URL index resolved up front. */
function leipzig(pkg) {
  const base = `${CACHE}${pkg}/${pkg}`
  const locators = leipzigLocators(
    readFileSync(`${base}-inv_so.txt`, 'utf8'),
    readFileSync(`${base}-sources.txt`, 'utf8'),
  )
  const lines = createInterface({
    input: createReadStream(`${base}-sentences.txt`),
    crlfDelay: Infinity,
  })
  return leipzigSentences(lines, locators)
}

/** A directory of Gutenberg texts, each named by its permanent ebook number. */
function gutenberg(dir) {
  const at = `${CACHE}${dir}`
  const books = readdirSync(at)
    .filter((file) => file.endsWith('.txt'))
    .map((file) => ({ locator: file.replace('.txt', ''), path: `${at}/${file}` }))
  return fileDocuments(books, async (path) => gutenbergBody(readFileSync(path, 'utf8')))
}

export const SOURCES = [
  {
    id: 'wiki:es',
    what: 'Spanish Wikipedia — modern encyclopedic prose',
    needs: `${CACHE}eswiki.xml.bz2`,
    documents: () => wikiDocuments(`${CACHE}eswiki.xml.bz2`),
  },
  {
    id: 'wikisource:es',
    what: 'Wikisource — same Wikimedia family, so it corroborates rather than counts',
    needs: `${CACHE}eswikisource.xml.bz2`,
    documents: () => wikiDocuments(`${CACHE}eswikisource.xml.bz2`),
  },
  {
    id: 'lz:spa_news_2024_1M',
    what: 'Leipzig spa_news_2024_1M — modern news, cited by the page each sentence came from',
    needs: `${CACHE}spa_news_2024_1M`,
    documents: () => leipzig('spa_news_2024_1M'),
  },
  {
    id: 'lz:spa_news_2023_1M',
    what: 'Leipzig spa_news_2023_1M — modern news, cited by the page each sentence came from',
    needs: `${CACHE}spa_news_2023_1M`,
    documents: () => leipzig('spa_news_2023_1M'),
  },
  {
    id: 'tat',
    from: 'https://downloads.tatoeba.org/exports/per_language/spa/spa_sentences.tsv.bz2',
    what: 'Tatoeba — contemporary, conversational',
    needs: `${CACHE}spa_sentences.tsv`,
    documents: () => tatoebaDocuments(`${CACHE}spa_sentences.tsv`),
  },
  {
    id: 'gut',
    from: 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv',
    what: 'Project Gutenberg — published books, a register nothing else here reaches',
    needs: `${CACHE}gutenberg-es`,
    documents: () => gutenberg('gutenberg-es'),
  },
  {
    id: 'ebible:spaRV1909',
    from: 'https://ebible.org/Scriptures/spaRV1909_vpl.zip',
    what: 'A translation — a family nothing else here belongs to',
    needs: `${CACHE}ebible-spaRV1909/spaRV1909_vpl.txt`,
    documents: () => verseDocuments(`${CACHE}ebible-spaRV1909/spaRV1909_vpl.txt`),
  },
  {
    id: 'ia',
    // Scanned books are OCR, and OCR fails in a way that looks like text. Clean Gutenberg scores
    // a median 52% known words and never below 36%; the worst of these scored 1%, an English
    // book read as Cyrillic. Below this floor a book is not legible enough to attest anything.
    legible: 0.35,
    what: 'Internet Archive spanish books — literature, and the register a newspaper never reaches',
    needs: `${CACHE}archive-es`,
    from: 'https://archive.org/details/booksbylanguage_spanish',
    documents: () => {
      const dir = `${CACHE}archive-es`
      // A locator names the text, not the item: the catalogue page holds no word of the book.
      // `files.tsv` maps an item to the file we read; a book with no recorded name is skipped
      // rather than cited at a page that cannot support it.
      const named = new Map(
        readFileSync(`${dir}/files.tsv`, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => line.split('\t')),
      )
      const books = readdirSync(dir)
        .filter((file) => file.endsWith('.txt'))
        .map((file) => file.replace('.txt', ''))
        .filter((id) => named.has(id))
        // The filename is percent-encoded: two thirds of them contain spaces, and a locator with
        // a space in it would split into two locators, because the evidence format spends spaces
        // as separators. Encoding is also what the URL needs.
        .map((id) => ({
          locator: `${id}/${encodeURIComponent(named.get(id))}`,
          path: `${dir}/${id}.txt`,
        }))
      return fileDocuments(books, async (path) => readFileSync(path, 'utf8'))
    },
  },
].filter((source) => {
  // A collection that has not been downloaded is skipped with a warning rather than crashing
  // the build, and which collections a language actually has is a fact worth seeing in the log.
  // Checked by path rather than by calling `documents()`: these are lazy generators, so calling
  // one proves nothing and calling it twice would open the file twice.
  if (existsSync(source.needs)) return true
  process.stderr.write(`  (skipping ${source.id}: ${source.needs} is not in .cache/raw)\n`)
  return false
})

/**
 * Pages fetched by searching for words the collections missed, one family per domain.
 *
 * Absent until a harvest has been run; see the repository README.
 */
export const HARVEST = existsSync(new URL('searched.tsv', import.meta.url).pathname)
  ? () => harvestDocuments(new URL('searched.tsv', import.meta.url).pathname)
  : undefined

/** Spanish publishers, each its own family. Spain and Latin America write different Spanish. */
export const DOMAINS = [
  // Books, letters and scholarship. Spanish's drop list says 40,172 words are attested by a
  // Wikipedia and a Gutenberg and nothing else — ordinary literary Spanish that news never uses.
  // The missing family is not more text, it is another shelf of books gathered by somebody else.
  'cervantesvirtual.com', 'biblioteca.org.ar', 'ciudadseva.com', 'cvc.cervantes.es',
  'letraslibres.com', 'zendalibros.com', 'elcultural.com', 'revistaarcadia.com',
  'elpais.com', 'elmundo.es', 'abc.es', 'lavanguardia.com', 'eldiario.es',
  'elconfidencial.com', '20minutos.es', 'publico.es', 'rtve.es', 'larazon.es',
  // Latin America, which is most Spanish speakers
  'clarin.com', 'lanacion.com.ar', 'pagina12.com.ar', 'eluniversal.com.mx',
  'milenio.com', 'jornada.com.mx', 'eltiempo.com', 'elespectador.com',
  'emol.com', 'latercera.com', 'elcomercio.pe', 'elnacional.com',
]

/** Carried over from Blinkered's calibration; must be re-measured before anything ships. */
export const COMMON_CUT = 16993
