const STORAGE_KEY = "OakTrackerData"
var data = null

document.addEventListener("DOMContentLoaded", function() {
    let dataPath = `data`
    if (typeof getDataPath === 'function') {
        dataPath = getDataPath()
    } else {
        console.log(`getDataPath function not defined in template, will use ${dataPath} as default`)
    }
    document.querySelectorAll('.wild-area-table').forEach((table) => {
        const filename = table.id
        fetch(`${dataPath}/${filename}.json`).then(response => response.json().then(data => {
            table.innerHTML = Object.entries(data).map(([location, habitatMap]) => 
                renderLocationData(location, habitatMap)
            ).join('');
    
            initStorageAndEvents();
        }));
    })
});

/**
 * @param {string} location 
 * @param {object} habitatMap 
 * @return {string} html
 */
function renderLocationData(location, habitatMap) {
    const pkmnNum = Object.values(habitatMap).map(countHabitatMembers).reduce((prevValue, curValue) => prevValue + curValue, 0)

    const locationId = slugify(location) + "-loc-cell"
    const locationCell = /*html*/`<td 
        rowspan="${pkmnNum}" 
        class="area-cell" 
        id="${locationId}"
        >${location}</td>`
    
    return Object.entries(habitatMap).map(([habitatName, habitatContent], locIndex) => {
        const habitatPkmnNum = countHabitatMembers(habitatContent)
        const locFirst = locIndex === 0

        const habitatId = slugify(habitatName) + "-" + slugify(location) + "-hab-cell"
        const habitatCell = /*html*/`<td 
            rowspan="${habitatPkmnNum}" 
            class="habitat-cell" 
            id="${habitatId}"
            data-loc="${locationId}"
            >${habitatName}</td>`

        if (Array.isArray(habitatContent)) {
            return habitatContent.map((monData, index) => {
                const first = index === 0
                return /*html*/`<tr>
                    ${(locFirst && first) ? locationCell : ''}
                    ${(first) ? habitatCell : ''}
                    ${(first) ? /*html*/`<td rowspan="${habitatPkmnNum}" class="subcat-cell blank"></td>` : ''}
                    <td data-loc="${locationId}" data-hab="${habitatId}">${renderMonData(monData)}</td>
                </tr>`
            }).join('');
        } else {
            return Object.entries(habitatContent).map(([subcatName, mons], habitatIndex) => {
                const num = mons.length
                const habitatFirst = habitatIndex === 0

                const subcatId = slugify(habitatName) + "-" + slugify(location) + "-" + slugify(subcatName) + "-sub-cell"
                const subcatCell = /*html*/`<td 
                    rowspan="${num}" 
                    class="subcat-cell" 
                    id="${subcatId}"
                    data-loc="${locationId}"
                    data-hab="${habitatId}"
                    >${subcatName}</td>`
                
                return mons.map((monData, index) => {
                    const first = index === 0
                    return /*html*/`<tr>
                        ${(locFirst && habitatFirst && first) ? locationCell : ''}
                        ${(habitatFirst && first) ? habitatCell : ''}
                        ${(first) ? subcatCell : ''}
                        <td data-loc="${locationId}" data-hab="${habitatId}" data-sub="${subcatId}">${renderMonData(monData)}</td>
                    </tr>`
                }).join('');
            }).join('');
        }
    }).join('');
}

/**
 * @param {Array|Object} habitatContent 
 */
function countHabitatMembers(habitatContent) {
    if (Array.isArray(habitatContent)) {
        return habitatContent.length
    } else {
        return Object.values(habitatContent).reduce((prevValue, curValue) => {
            return prevValue + curValue.length
        }, 0);
    }
}

/**
 * @param {Object} monData 
 */
function renderMonData(monData) {
    return /*html*/`<div>
    ${ monData.pokemon } (${ monData.chance_pct }%)
    </div>
    <input type="checkbox" class="caught-checkbox" name="${monData.pokemon}">
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

function applyLoadedData() {
    document.querySelectorAll('input.caught-checkbox').forEach(el => {
        el.checked = isCaught(el.name)
    });
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
        el.checked = isCaught(el.name)

        el.addEventListener('change', ev => {
            const name = el.name
            setCaught(name, el.checked)
            document.querySelectorAll('input.caught-checkbox[name=' + name + ']').forEach(el2 => {
                el2.checked = el.checked
            });
        });
    });

    document.querySelectorAll('.area-cell').forEach(el => {
        el.dataset.collapsed = "false"
        el.classList.add("clickable")
        el.addEventListener('click', ev => {
            const collapsed = el.dataset.collapsed == "true"
            const newCollapsed = !collapsed
            document.querySelectorAll(`[data-loc="${el.id}"]`).forEach(child => toggleVisibility(child, newCollapsed))
            if (newCollapsed)
                el.colSpan = "4"
            else
                el.colSpan = "1"

            el.dataset.collapsed = String(newCollapsed)
        });
    });

    document.querySelectorAll('.habitat-cell').forEach(el => {
        el.dataset.collapsed = "false"
        el.classList.add("clickable")
        el.addEventListener('click', ev => {
            const collapsed = el.dataset.collapsed == "true"
            const newCollapsed = !collapsed
            document.querySelectorAll(`[data-hab="${el.id}"]`).forEach(child => toggleVisibility(child, newCollapsed))
            if (newCollapsed)
                el.colSpan = "3"
            else
                el.colSpan = "1"

            el.dataset.collapsed = String(newCollapsed)
        });
    });

    document.querySelectorAll('.subcat-cell').forEach(el => {
        el.dataset.collapsed = "false"
        el.classList.add("clickable")
        el.addEventListener('click', ev => {
            const collapsed = el.dataset.collapsed == "true"
            const newCollapsed = !collapsed
            document.querySelectorAll(`[data-sub="${el.id}"]`).forEach(child => toggleVisibility(child, newCollapsed))
            if (newCollapsed)
                el.colSpan = "2"
            else
                el.colSpan = "1"

            el.dataset.collapsed = String(newCollapsed)
        });
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

    document.getElementById('upload-button').onclick = async () => {
        const jsonFile = await getJsonUpload()
        data = JSON.parse(jsonFile)
        localStorage.setItem(STORAGE_KEY, jsonFile)
        applyLoadedData()
    }
}

/** @param {HTMLElement} element */
function toggleVisibility(element, value) {
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