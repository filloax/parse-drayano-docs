const STORAGE_KEY = "OakTrackerData";
var data = null;
/** @type {Record<string, LocationData>} */
var locationDataMap = null;
const START_COLLAPSED = true;

const STATIC_HIDDEN_GROTTOS = {
    'Giants Chasm - Route 13': 'Giant Chasm',
}

document.addEventListener("DOMContentLoaded", function() {
    let dataPath = `data`
    if (typeof getDataPath === 'function') {
        dataPath = getDataPath()
    } else {
        console.log(`getDataPath function not defined in template, will use ${dataPath} as default`)
    }
    const hiddenGrottoPromise = fetch(`${dataPath}/hidden_grotto.json`).then(response => Promise.resolve(response.json()));
    locationDataMap = {};
    Promise.all([...document.querySelectorAll('.wild-area-table')].map((table) => {
        const filename = table.id
        const subdataPromise = fetch(`${dataPath}/${filename}.json`).then(response => Promise.resolve(response.json()));
        return Promise.all([subdataPromise, hiddenGrottoPromise]).then(([subdata, hiddenGrottoData]) => {
            const entries = Object.entries(subdata);
            entries.forEach(([location, habitatMap]) => {
                locationDataMap[getLocationId(location)] = initLocationData(location, habitatMap, hiddenGrottoData);
            });
            table.innerHTML = entries.map(([location, _]) => {
                    const locationData = locationDataMap[getLocationId(location)];
                    return renderLocationData(location, locationData);
                }).join('');
            buildLocationTrees();
        });
    })).then(() => {
        initStorageAndEvents();
    });
}, { once: true });

/** @typedef {Record<string, Record<string, Array<HabitatPokemon>> | Array<HabitatPokemon>>} HabitatMap */

class LocationData {
    /** @type {string} */
    name;
    /** @type {HabitatMap} */
    habitats;
    /** @type {Record<string, Array<HiddenGrottoPokemon>>} */
    hiddenGrottos;
    /** @type {Array<string>} */
    uniqueAllPokemon;
}

class HabitatPokemon {
    /** @type {string} */
    pokemon;
    /** @type {number} */
    chance_pct;
    /** @type {Array<number>} */
    level_range;
    /** @type {string|null} */
    notes;
}

class HiddenGrottoPokemon {
    /** @type {string} */
    pokemon;
    /** @type {number} */
    level;
    /** @type {boolean} */
    forcedFirst;
}

/**
 * @param {string} location 
 * @param {HabitatMap} habitatMap 
 * @param {object} hiddenGrottoData 
 * @return {object}
 */
function initLocationData(location, habitatMap, hiddenGrottoData) {
    /** @type {LocationData} */
    const out = {};

    const matchingHiddenGrottos = Object.entries(hiddenGrottoData).filter(([hgName, hgData]) => 
            location.split(/\s*-\s*/)[0].trim() === hgName.split(/\s*-\s*/)[0].trim()
                || STATIC_HIDDEN_GROTTOS[location] === hgName
        );
    const uniqueAllPokemon = [];
    Object.values(habitatMap).forEach(habitatContent => {
        const noSubcat = Array.isArray(habitatContent)
        if (noSubcat) {
            habitatContent.forEach(monData => uniqueAllPokemon.push(monData.pokemon));
        } else {
            Object.values(habitatContent).forEach(subcatContent => subcatContent.forEach(monData => uniqueAllPokemon.push(monData.pokemon)));
        }
    });
    Object.values(matchingHiddenGrottos).forEach(hgData => Object.values(hgData).forEach((monData) => {
        const name = (typeof monData === 'string') ? monData : monData.pokemon
        uniqueAllPokemon.push(name);
    }));

    out.name = location;
    out.habitats = habitatMap;
    out.hiddenGrottos = matchingHiddenGrottos;
    out.uniqueAllPokemon = [...new Set(uniqueAllPokemon)];
    return out;
}

function getLocationId(location) {
    return slugify(location) + "-loc-cell";
}

/**
 * @param {string} location 
 * @param {LocationData} locationData 
 * @return {string} html
 */
function renderLocationData(location, locationData) {
    const matchingHiddenGrottos = locationData.hiddenGrottos;
    const habitatMap = locationData.habitats;
    const pkmnNum = Object.values(habitatMap).map(countHabitatMembers).reduce(sum, 0)
        + matchingHiddenGrottos.map(([k, v]) => v).map(countGrottoMembers).reduce(sum, 0);

    const locationId = getLocationId(location);
    const locationCell = /*html*/`<td 
        rowspan="${pkmnNum}" 
        class="area-cell tracker-cell" 
        id="${locationId}"
        data-isloc="true"
        >${location}</td>`;
    
    const pokeCellBuilder = (monData, habitatId, subcatId, renderer) => /*html*/`<td 
            data-loc="${locationId}"
            data-hab="${habitatId}" 
            ${subcatId ? ("data-sub=\""+subcatId+"\"") : ""}
            data-isloc="true" 
            id="${subcatId ? 
                `${monData.pokemon}-${subcatId}-${habitatId}-${locationId}`
                : `${monData.pokemon}-${habitatId}-${locationId}`
            }"
            class="poke-cell tracker-cell"
        >${renderer(monData)}</td>`

    let _locFirst = true
    let output = Object.entries(habitatMap).map(([habitatName, habitatContent]) => {
        const locFirst = _locFirst
        _locFirst = false

        const habitatPkmnNum = countHabitatMembers(habitatContent)

        const noSubcat = Array.isArray(habitatContent)
        const habitatId = slugify(habitatName) + "-" + slugify(location) + "-hab-cell"
        const habitatCell = /*html*/`<td 
            rowspan="${habitatPkmnNum}" 
            class="habitat-cell tracker-cell" 
            id="${habitatId}"
            data-loc="${locationId}"
            data-isloc="true"
            ${noSubcat ? ` colspan="2"` : ''}
            >${habitatName}</td>`

        if (noSubcat) {
            let _first = true
            return habitatContent.map(monData => {
                const first = _first
                _first = false
                return /*html*/`<tr>
                    ${(locFirst && first) ? locationCell : ''}
                    ${(first) ? habitatCell : ''}
                    ${pokeCellBuilder(monData, habitatId, null, renderMonData)}
                </tr>`
            }).join('');
        } else {
            let _habitatFirst = true
            return Object.entries(habitatContent).map(([subcatName, mons]) => {
                const habitatFirst = _habitatFirst
                _habitatFirst = false
                
                const num = mons.length

                const subcatId = slugify(habitatName) + "-" + slugify(location) + "-" + slugify(subcatName) + "-sub-cell"
                const subcatCell = /*html*/`<td 
                    rowspan="${num}" 
                    class="subcat-cell tracker-cell" 
                    id="${subcatId}"
                    data-loc="${locationId}"
                    data-hab="${habitatId}"
                    data-isloc="true"
                    >${subcatName}</td>`
                
                let _first = true
                return mons.map(monData => {
                    const first = _first
                    _first = false

                    return /*html*/`<tr>
                        ${(locFirst && habitatFirst && first) ? locationCell : ''}
                        ${(habitatFirst && first) ? habitatCell : ''}
                        ${(first) ? subcatCell : ''}
                        ${pokeCellBuilder(monData, habitatId, subcatId, renderMonData)}
                        </tr>`
                }).join('');
            }).join('');
        }
    }).join('');

    matchingHiddenGrottos.forEach(([hgName, hgData]) => {
        const locFirst = _locFirst
        _locFirst = false
        const count = countGrottoMembers(hgData)
        const grottoId = "hg-" + slugify(hgName) + "-" + slugify(location) + "-hab-cell"
        const grottoCell = /*html*/`<td 
            rowspan="${count}" 
            class="habitat-cell tracker-cell" 
            id="${grottoId}"
            data-loc="${locationId}"
            >Hidden Grotto (${hgName})</td>`;

        let _grottoFirst = true;
        output += Object.entries(hgData).map(([rarity, mons]) => {
            const grottoFirst = _grottoFirst;
            _grottoFirst = false;

            const num = mons.length;
            const rarityName = rarity.replace(/\s*Encounters/, '');
            const rarityId = slugify(rarityName) + "-hg-" + slugify(hgName) + "-" + slugify(location) + "-hab-cell"
            const rarityCell = /*html*/`<td 
                rowspan="${num}" 
                class="subcat-cell tracker-cell" 
                id="${rarityId}"
                data-loc="${locationId}"
                data-hab="${grottoId}"
                data-isloc="true"
                >${rarityName}</td>`

            let _first = true
            return mons.map(monData => {
                const first = _first
                _first = false

                return /*html*/`<tr>
                    ${(locFirst && grottoFirst && first) ? locationCell : ''}
                    ${(grottoFirst && first) ? grottoCell : ''}
                    ${(first) ? rarityCell : ''}
                    ${pokeCellBuilder(monData, grottoId, rarityId, renderHiddenGrottoMonData)}
                </tr>`
            }).join('');
        }).join('');
    });
    return output;
}

/**
 * @param {Array|Object} habitatContent 
 */
function countHabitatMembers(habitatContent) {
    if (Array.isArray(habitatContent)) {
        return habitatContent.length
    } else {
        return Object.values(habitatContent)
            .map(a => a.length)
            .reduce(sum, 0);
    }
}

/**
 * @param {Object} hiddenGrottoData 
 */
function countGrottoMembers(hiddenGrottoData) {
    return Object.values(hiddenGrottoData)
        .map(a => a.length)
        .reduce(sum, 0);
}

/**
 * @param {Object} monData 
 */
function renderMonData(monData) {
    return /*html*/`<div>
    ${ monData.pokemon }${monData.chance_pct ? `  (${ monData.chance_pct }%)` : ''}
    </div>
    <input type="checkbox" class="caught-checkbox" name="${monData.pokemon}">
    `
}

/**
 * @param {Object} monData 
 */
function renderHiddenGrottoMonData(monData) {
    const name = (typeof monData === 'string') ? monData : monData.pokemon

    return /*html*/`<div>
    ${ name }
    </div>
    <input type="checkbox" class="caught-checkbox" name="${name.toLowerCase()}">
    `
}


function setCaught(name, value) {
    const prev = data[name]
    data[name] = value
    if (value !== prev) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
}

function isCaught(name) {
    return data[name] == true
}

const elementTrees = {}
const elementTreeParents = {}

function buildLocationTrees() {
    document.querySelectorAll('.area-cell').forEach(loc => {
        const locObj = {};
        elementTrees[loc.id] = {
            'element': loc,
            'map': locObj,
        };
        document.querySelectorAll(`.habitat-cell[data-loc="${loc.id}"]`).forEach(habitat => {
            let habObj;
            const subcategories = document.querySelectorAll(`.subcat-cell[data-hab="${habitat.id}"]`)
            elementTreeParents[habitat.id] = loc.id;

            if (subcategories.length > 0) {
                habObj = {};
                locObj[habitat.id] = {
                    'element': habitat,
                    'map': habObj,
                };
            } else {
                habObj = [];
                locObj[habitat.id] = {
                    'element': habitat,
                    'list': habObj,
                };
            }
            elementTrees[habitat.id] = locObj[habitat.id];
            subcategories.forEach(subcat => {
                if (subcat.classList.contains("blank")) {
                    habObj[subcat.id] = {
                        'element': subcat,
                    };
                    return;
                }
                const subcatList = []
                habObj[subcat.id] = {
                    'element': subcat,
                    'list': subcatList,
                }
                elementTrees[subcat.id] = habObj[subcat.id];
                elementTreeParents[subcat.id] = habitat.id;
                document.querySelectorAll(`.poke-cell[data-sub="${subcat.id}"]`).forEach(poke => {
                    subcatList.push(poke)
                    elementTreeParents[poke.id] = subcat.id;
                });
            });

            if (subcategories.length == 0) {
                document.querySelectorAll(`.poke-cell[data-hab="${habitat.id}"]`).forEach(poke => {
                    habObj.push(poke)
                    elementTreeParents[poke.id] = habitat.id;
                });
            }
        });
    });
}

function applyLoadedData() {
    document.querySelectorAll('input.caught-checkbox').forEach(el => {
        el.checked = isCaught(el.name)
    });

    const alreadyChecked = {};
    document.querySelectorAll(".poke-cell").forEach(updateCompleted, alreadyChecked);
}

function visitTree(tree, elementFunction, skipFirst=true) {
    if (typeof tree === 'string' || tree instanceof String) {
        return visitTree(elementTrees[tree], elementFunction, skipFirst);
    }
    if (tree instanceof HTMLElement) {
        if (!skipFirst) elementFunction(tree);
    } else if (tree) {
        if (!skipFirst) elementFunction(tree.element);
        if (tree.map) {
            Object.values(tree.map).forEach(child => visitTree(child, elementFunction, false));
        }
        if (tree.list) {
            tree.list.forEach(child => visitTree(child, elementFunction, false));
        }
    }
}

function visitTreeReverse(nodeId, elementFunction, skipFirst=true) {
    const node = elementTrees[nodeId];
    if (!skipFirst)
        elementFunction(node.element);
    if (elementTreeParents[nodeId]) {
        visitTreeReverse(elementTreeParents[nodeId], elementFunction, false);
    }
}

var originalElementWidths = {}

/**
 * @param {HTMLElement} pokemonCell 
 */
function updateCompleted(pokemonCell, alreadyChecked=null) {
    visitTreeReverse(pokemonCell.id, /** @param {HTMLElement} element */ element => {
        if (alreadyChecked && alreadyChecked[element.id]) {
            return;
        }
        if (alreadyChecked)
            alreadyChecked[element.id] = true;

        const pokemonList = new Set();
        visitTree(element.id, /** @param {HTMLElement} el2 */ el2 => {
            if (!el2.classList.contains("poke-cell")) return;

            const checkbox = el2.querySelector("input.caught-checkbox")
            const name = checkbox.name;
            pokemonList.add(name);
        });
        if ([...pokemonList].every(isCaught)) {
            element.classList.add("completed")
        } else {
            element.classList.remove("completed")
        }
    });

    const locId = pokemonCell.dataset["loc"];
    const locElement = document.getElementById(locId);
    const locationData = locationDataMap[locId];
    const pctComplete = locationData.uniqueAllPokemon.map(x => isCaught(x) ? 1 : 0).reduce((x, y) => x + y, 0) / locationData.uniqueAllPokemon.length;
    locElement.dataset["completepct"] = Number(pctComplete).toLocaleString(undefined, {style: 'percent'});
    updateCompletedPercent(locElement);
}

/** @param {HTMLElement} areaElement */
function updateCompletedPercent(areaElement) {
    const h2el = areaElement.querySelector("h2")
    const h2elSpan = h2el.querySelector("span")
    if (areaElement.dataset["collapsed"] === "true") {
        if (!h2elSpan) {
            const newSpan = document.createElement("span");
            newSpan.innerText = `[${areaElement.dataset["completepct"]}]`;
            h2el.appendChild(newSpan);
        } else {
            h2elSpan.innerText = `[${areaElement.dataset["completepct"]}]`;
        }
    } else if (areaElement.dataset["collapsed"] !== "true" && h2elSpan) {
        h2el.removeChild(h2elSpan)
    }
}

function initStorageAndEvents() {
    let strData = localStorage.getItem(STORAGE_KEY)
    if (strData === null) {
        data = {}
        strData = JSON.stringify(data)
        localStorage.setItem(STORAGE_KEY, strData)
    } else {
        data = JSON.parse(strData)
    }

    document.querySelectorAll('td.area-cell').forEach(el => {
        const content = el.innerHTML
        el.innerHTML = /*html*/`<div class="sticky"><h2>${content}</h3></div>`
    });
    document.querySelectorAll('td.habitat-cell').forEach(el => {
        const content = el.innerHTML
        el.innerHTML = /*html*/`<div class="sticky"><h3>${content}</h3></div>`
    });
    document.querySelectorAll('input.caught-checkbox').forEach(el => {
        el.checked = isCaught(el.name);

        el.addEventListener('change', ev => {
            const name = el.name
            setCaught(name, el.checked);
            document.querySelectorAll('input.caught-checkbox[name=' + name + ']').forEach(el2 => {
                el2.checked = el.checked
            });
            const parent = el.parentElement;
            console.log("CHANGED", name, parent);
            updateCompleted(parent, {});
        });
    });

    document.querySelectorAll('.area-cell,.habitat-cell,.subcat-cell').forEach(el => {
        const originalWidth = el.colSpan || "1";
        el.dataset.collapsed = "false";
        el.classList.add("clickable");
        originalElementWidths[el.id] = originalWidth

        el.addEventListener('click', ev => toggleVisibility(el));

        if (START_COLLAPSED) toggleVisibility(el)
    });

    document.getElementById('download').addEventListener('click', () => {
        console.log(data)
        let dl = document.createElement('a')
        dl.download = 'tracker-data.json'
        dl.href = `data:application/json;charset=utf-8,${JSON.stringify(data)}`
        dl.click()
    });

    const getJsonUpload = () => new Promise(resolve => {
        const inputFileElement = document.createElement('input')
        inputFileElement.setAttribute('type', 'file')
        inputFileElement.setAttribute('accept', '.json')
        
        inputFileElement.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return

            resolve(await file.text())
        }, false);
        inputFileElement.click()
    });

    document.getElementById('upload-button').addEventListener('click', async () => {
        const jsonFile = await getJsonUpload()
        data = JSON.parse(jsonFile)
        localStorage.setItem(STORAGE_KEY, jsonFile)
        applyLoadedData()
    });

    document.getElementById('collapse-all').addEventListener('click', () => {
        document.querySelectorAll('.area-cell').forEach(el => toggleVisibility(el));
    });

    const alreadyChecked = {};
    document.querySelectorAll(".poke-cell").forEach(updateCompleted, alreadyChecked);
}


/** @param {HTMLElement} element */
function toggleVisibility(element) {
    const collapsedWidth = element.classList.contains('area-cell') ? "4"
        : element.classList.contains('habitat-cell') ? "3"
        : element.classList.contains('subcat-cell') ? "2" : "1"
        ;
    const originalWidth = originalElementWidths[element.id]

    const collapsed = element.dataset.collapsed == "true";
    const newCollapsed = !collapsed;
    // document.querySelectorAll(`[data-loc="${el.id}"]`).forEach(child => toggleVisibility(child, newCollapsed))
    visitTree(elementTrees[element.id], child => toggleChildVisibility(child, newCollapsed));
    if (newCollapsed)
        element.colSpan = collapsedWidth;
    else
        element.colSpan = originalWidth;

    element.dataset.collapsed = String(newCollapsed);

    if (element.classList.contains('area-cell')) {
        updateCompletedPercent(element);
    }
}

/** @param {HTMLElement} element */
function toggleChildVisibility(element, value) {
    if (value)
        element.classList.add("hidden")
    else {
        element.classList.remove("hidden")
        delete element.dataset.collapsed
        element.colSpan = "1"
    }
}

function slugify(str) {
  return String(str)
    .normalize('NFKD') // split accented characters into their base characters and diacritical marks
    .replace(/[\u0300-\u036f]/g, '') // remove all the accents, which happen to be all in the \u03xx UNICODE block.
    .trim() // trim leading or trailing whitespace
    .toLowerCase() // convert to lowercase
    .replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
    .replace(/\s+/g, '-') // replace spaces with hyphens
    .replace(/-+/g, '-'); // remove consecutive hyphens
}

function sum(a, b) { return a + b }