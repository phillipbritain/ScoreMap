/**
 * Makes the city list city labels are chosen from (see docs/city-labels.md): Natural Earth's populated
 * places (public domain), cut down to each city's name, country, position, metro population and
 * whether it's a national capital, most populous first. Names are as on an American map: Natural
 * Earth's, which are mostly English already, with those it spells otherwise put right (see
 * englishNames). Run it with `npm run city-list` from `web/`
 * to fetch the places again and rewrite `src/globe/cityList.json`.
 */
import { writeFile } from 'node:fs/promises'

const placesUrl =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson'
const listFile = new URL('../src/globe/cityList.json', import.meta.url)

interface Place {
  properties: { name: string; adm0name: string; latitude: number; longitude: number; pop_max: number | null; adm0cap: number }
}

/**
 * English names, as on an American map, for Natural Earth's places it names otherwise: [its name,
 * its country, the English name], each naming the most populous place of that name in that country.
 * Natural Earth's own English names (`NAME_EN`) are too often wrong to use (Cuttack, India, is
 * "Pochinki" there), so these are chosen by hand. Names English writes in their own spelling, accents
 * and all (São Paulo, Kraków), stay as they are.
 */
const englishNames: [string, string, string][] = [
  // Places English has its own name for
  ['København', 'Denmark', 'Copenhagen'],
  ['Århus', 'Denmark', 'Aarhus'],
  ['Göteborg', 'Sweden', 'Gothenburg'],
  ['Nürnberg', 'Germany', 'Nuremberg'],
  ['Antwerpen', 'Belgium', 'Antwerp'],
  ['Gent', 'Belgium', 'Ghent'],
  ['Brugge', 'Belgium', 'Bruges'],
  ['Luzern', 'Switzerland', 'Lucerne'],
  ['Saint Gallen', 'Switzerland', 'St. Gallen'],
  ['Siracusa', 'Italy', 'Syracuse'],
  ['Iraklio', 'Greece', 'Heraklion'],
  ['Patra', 'Greece', 'Patras'],
  ['Hania', 'Greece', 'Chania'],
  ['Rodos', 'Greece', 'Rhodes'],
  ['Kerkira', 'Greece', 'Corfu'],
  ['Mitilini', 'Greece', 'Mytilene'],
  ['Hios', 'Greece', 'Chios'],
  ['Ioanina', 'Greece', 'Ioannina'],
  ['Lemosos', 'Cyprus', 'Limassol'],
  ['Larnaka', 'Cyprus', 'Larnaca'],
  ['Makkah', 'Saudi Arabia', 'Mecca'],
  ['Banghazi', 'Libya', 'Benghazi'],
  ['Tubruq', 'Libya', 'Tobruk'],
  ['Surt', 'Libya', 'Sirte'],
  ['Darnah', 'Libya', 'Derna'],
  ['Ṭarābulus', 'Lebanon', 'Tripoli'],
  ['Saida', 'Lebanon', 'Sidon'],
  ['Bur Said', 'Egypt', 'Port Said'],
  ['Dumyat', 'Egypt', 'Damietta'],
  ['Al Khalil', 'Palestine', 'Hebron'],
  ['Beer Sheva', 'Israel', 'Beersheba'],
  ['Montréal', 'Canada', 'Montreal'],
  ['Québec', 'Canada', 'Quebec'],
  // Spelled as English spells them
  ['Ōsaka', 'Japan', 'Osaka'],
  ['Kōbe', 'Japan', 'Kobe'],
  ['Kitakyūshū', 'Japan', 'Kitakyushu'],
  ['Hachiōji', 'Japan', 'Hachioji'],
  ['Xian', 'China', "Xi'an"],
  ['Luan', 'China', "Lu'an"],
  ['Taian', 'China', "Tai'an"],
  ['Maanshan', 'China', "Ma'anshan"],
  ['Jian', 'China', "Ji'an"],
  ['Yaan', 'China', "Ya'an"],
  ['Haora', 'India', 'Howrah'],
  ['Vishakhapatnam', 'India', 'Visakhapatnam'],
  ['Nasik', 'India', 'Nashik'],
  ['Sholapur', 'India', 'Solapur'],
  ['Jullundur', 'India', 'Jalandhar'],
  ['Dehra Dun', 'India', 'Dehradun'],
  ['Raurkela', 'India', 'Rourkela'],
  ['Kelang', 'Malaysia', 'Klang'],
  ['Songnam', 'South Korea', 'Seongnam'],
  ['Bandjarmasin', 'Indonesia', 'Banjarmasin'],
  ['Louangphrabang', 'Laos', 'Luang Prabang'],
  ['Pakxe', 'Laos', 'Pakse'],
  ['Ft. Worth', 'United States of America', 'Fort Worth'],
  ['Ft. Myers', 'United States of America', 'Fort Myers'],
  ['Ft. Dodge', 'United States of America', 'Fort Dodge'],
  ['Rostov', 'Russia', 'Rostov-on-Don'],
  ['Archangel', 'Russia', 'Arkhangelsk'],
  ['Komsomolsk na Amure', 'Russia', 'Komsomolsk-on-Amur'],
  ['Nikolayevsk na Amure', 'Russia', 'Nikolayevsk-on-Amur'],
  ['Yuzhno Sakhalinsk', 'Russia', 'Yuzhno-Sakhalinsk'],
  ['Khanty Mansiysk', 'Russia', 'Khanty-Mansiysk'],
  ['Yoshkar Ola', 'Russia', 'Yoshkar-Ola'],
  ['Velikiy Novgorod', 'Russia', 'Veliky Novgorod'],
  ['Kamensk Uralskiy', 'Russia', 'Kamensk-Uralsky'],
  ['Zaporizhzhya', 'Ukraine', 'Zaporizhzhia'],
  ['Mykolayiv', 'Ukraine', 'Mykolaiv'],
  ['Kryvyy Rih', 'Ukraine', 'Kryvyi Rih'],
  ['Vinnytsya', 'Ukraine', 'Vinnytsia'],
  ['Khmelnytskyy', 'Ukraine', 'Khmelnytskyi'],
  ['Makiyivka', 'Ukraine', 'Makiivka'],
  ['Uzhgorod', 'Ukraine', 'Uzhhorod'],
  ['Berdyansk', 'Ukraine', 'Berdiansk'],
  ['Hamah', 'Syria', 'Hama'],
  ['Ar Raqqah', 'Syria', 'Raqqa'],
  ['Dayr az Zawr', 'Syria', 'Deir ez-Zor'],
  ['Irbil', 'Iraq', 'Erbil'],
  ['As Sulaymaniyah', 'Iraq', 'Sulaymaniyah'],
  ['Al Hillah', 'Iraq', 'Hillah'],
  ['An Nasiriyah', 'Iraq', 'Nasiriyah'],
  ['Ar Ramadi', 'Iraq', 'Ramadi'],
  ['Al Fallujah', 'Iraq', 'Fallujah'],
  ['Az Zarqa', 'Jordan', 'Zarqa'],
  ['Al Aqabah', 'Jordan', 'Aqaba'],
  ['At Taif', 'Saudi Arabia', 'Taif'],
  ['Az Zahran', 'Saudi Arabia', 'Dhahran'],
  ['Taizz', 'Yemen', "Ta'izz"],
  ['Al Mukalla', 'Yemen', 'Mukalla'],
  ['El Minya', 'Egypt', 'Minya'],
  ['Ras al Khaymah', 'United Arab Emirates', 'Ras al-Khaimah'],
  ['Al Fujayrah', 'United Arab Emirates', 'Fujairah'],
  ['Al Ayn', 'United Arab Emirates', 'Al Ain'],
  ['Umm al Qaywayn', 'United Arab Emirates', 'Umm al-Quwain'],
  ['Bandar-e-Abbas', 'Iran', 'Bandar Abbas'],
  ['Bandar-e Bushehr', 'Iran', 'Bushehr'],
  ['Kondoz', 'Afghanistan', 'Kunduz'],
  ['Qaraghandy', 'Kazakhstan', 'Karaganda'],
  ['Aqtobe', 'Kazakhstan', 'Aktobe'],
  ['Qyzylorda', 'Kazakhstan', 'Kyzylorda'],
  ['Taldyqorghan', 'Kazakhstan', 'Taldykorgan'],
  ['Fargona', 'Uzbekistan', 'Fergana'],
  ['Qoqon', 'Uzbekistan', 'Kokand'],
  ['Jizzax', 'Uzbekistan', 'Jizzakh'],
  ['Termiz', 'Uzbekistan', 'Termez'],
  ['Khiwa', 'Uzbekistan', 'Khiva'],
  ['Urgentch', 'Uzbekistan', 'Urgench'],
  ['Ganca', 'Azerbaijan', 'Ganja'],
  ['Sumqayt', 'Azerbaijan', 'Sumqayit'],
  ['Naxcivan', 'Azerbaijan', 'Nakhchivan'],
  ['Jalal Abad', 'Kyrgyzstan', 'Jalal-Abad'],
  ['Mekele', 'Ethiopia', 'Mekelle'],
  ['Kismaayo', 'Somalia', 'Kismayo'],
  ['Gaalkacyo', 'Somalia', 'Galkayo'],
  ['Boosaaso', 'Somalia', 'Bosaso'],
  ['Baydhabo', 'Somalia', 'Baidoa'],
  // Renamed
  ['Kirovohrad', 'Ukraine', 'Kropyvnytskyi'],
  ['Mangyshlak', 'Kazakhstan', 'Aktau'],
  ['Umtata', 'South Africa', 'Mthatha'],
  ['Grahamstown', 'South Africa', 'Makhanda'],
  // Misspelled
  ['Shenyeng', 'China', 'Shenyang'],
  ['Mudangiang', 'China', 'Mudanjiang'],
  ['Zhaotang', 'China', 'Zhaotong'],
  ['Yingkow', 'China', 'Yingkou'],
  ['Xiangtai', 'China', 'Xingtai'],
  ['Jiaojing', 'China', 'Jiaojiang'],
  ['Sialkote', 'Pakistan', 'Sialkot'],
  ['Pakalongan', 'Indonesia', 'Pekalongan'],
  ['Barlett', 'United States of America', 'Bartlett'],
  ['Grand Prairie', 'Canada', 'Grande Prairie'],
  ['Nizhenvartovsk', 'Russia', 'Nizhnevartovsk'],
  ['Starsy Oskol', 'Russia', 'Stary Oskol'],
  ['Oostanay', 'Kazakhstan', 'Kostanay'],
  ['Pizen', 'Czechia', 'Plzeň'],
  ['Poitier', 'France', 'Poitiers']
]

const response = await fetch(placesUrl)
if (!response.ok) throw new Error(`Fetching ${placesUrl} gave ${response.status} ${response.statusText}`)
const { features } = (await response.json()) as { features: Place[] }

// To about 10 m, which is plenty for a 50 km reach and keeps the file small.
const rounded = (degrees: number) => Math.round(degrees * 1e4) / 1e4

const cities = features
  .map(({ properties: p }) => ({
    // One line: Natural Earth writes "Washington,  D.C." with two spaces, and "Granada" with a hidden mark after it.
    name: p.name.replace(/[\s\u200e]+/g, ' ').trim(),
    country: p.adm0name,
    longitude: rounded(p.longitude),
    latitude: rounded(p.latitude),
    population: p.pop_max ?? 0,
    capital: p.adm0cap === 1,
  }))
  .sort((a, b) => b.population - a.population || a.name.localeCompare(b.name) || a.country.localeCompare(b.country))

for (const [name, country, english] of englishNames) {
  // The most populous first, so the first found.
  const city = cities.find((c) => c.name === name && c.country === country)
  if (!city) throw new Error(`Natural Earth has no ${name}, ${country} to name ${english}`)
  city.name = english
}

// One city a line, so a change to the list reads plainly in a diff.
await writeFile(listFile, `[\n${cities.map((city) => JSON.stringify(city)).join(',\n')}\n]\n`)
console.log(`Wrote ${cities.length} cities to ${listFile.pathname}`)
