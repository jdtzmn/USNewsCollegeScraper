const inquirer = require('inquirer')
const axios = require('axios')
const cheerio = require('cheerio')
const Table = require('cli-table')

// Register prompt
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'))

// --- AXIOS INSTANCE ---
const usnews = axios.create({
  baseURL: 'https://usnews.com'
})

// --- HELPER METHODS ---

let previousSearchResults = null
const searchColleges = (input) => {
  return usnews.get(`/best-colleges/api/autocomplete/schools?phrase=${input}&state=`)
    .then((response) => {
      const { data } = response
      const { items } = data.data
      const list = items.map((item) => item.suggestion_value)
      previousSearchResults = items
      return list
    })
}

const findCollege = (name) => {
  return previousSearchResults.find((item) => item.suggestion_value === name)
}

const getCollegeLink = (name) => {
  const path = findCollege(name).link
  return path
}

const scrapeFromPath = (path) => {
  return usnews.get(path).then((response) => {
    const { data } = response
    const $ = cheerio.load(data)

    // Name
    const name = $('div.flex-media-content > h1').text().trim()

    // Percentage
    const percentageText = $('span.distribution-breakdown__percentage').text()
    const percentageGender = $('span.distribution-breakdown__percentage-copy').text().trim()

    // Undergrad Students
    const undergraduateStudents = (/total undergraduate enrollment of ([\d,]*),/gm).exec($.html())[1]

    // Acceptance Rate
    const acceptanceRate = (/acceptance rate of (\d*)[\n ]*percent/gm).exec($.html())[1]


    const stats = {
      'College': name,
      'Percentage': `${percentageText} ${percentageGender}`,
      'Undergraduate #': undergraduateStudents,
      'Acceptance Rate': `${acceptanceRate}%`
    }

    return stats
  })
}

// --- MAIN METHODS ---

const main = async () => {
  return constructCollegeList()
}

const constructCollegeList = async (collegeLinksSoFar = []) => {
  // Ask for what college the user wants
  const { college, shouldContinue } = await inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'college',
      message: 'What college do you want info on?',
      source: (_, input) => searchColleges(input)
    },
    {
      type: 'confirm',
      name: 'shouldContinue',
      message: 'Would you like to keep adding colleges?'
    }
  ])

  collegeLinksSoFar.push(getCollegeLink(college))

  if (shouldContinue) {
    return constructCollegeList(collegeLinksSoFar)
  } else {
    return constructTable(collegeLinksSoFar)
  }
}

const constructTable = async (collegeLinks) => {
  const table = new Table()
  table.push(['College Name', 'Gender Ratio', 'Undergrad Students', 'Acceptance Rate'])

  for (let link of collegeLinks) {
    const data = await scrapeFromPath(link)
    table.push(Object.values(data))
  }

  console.log(table.toString())
}

// Run the main async code
main()
