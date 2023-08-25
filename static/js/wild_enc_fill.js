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
    
    return Object.entries(habitatMap).map(([habitatName, habitatContent], locIndex) => {
        const habitatPkmnNum = countHabitatMembers(habitatContent)
        const locFirst = locIndex === 0
        if (Array.isArray(habitatContent)) {
            return habitatContent.map((monData, index) => {
                const first = index === 0
                return /*html*/`<tr>
                    ${(locFirst && first) ? /*html*/`<td rowspan="${pkmnNum}" class="area-cell">${location}</td>` : ''}
                    ${(first) ? /*html*/`<td rowspan="${habitatPkmnNum}" class="habitat-cell">${habitatName}</td>` : ''}
                    ${(first) ? /*html*/`<td rowspan="${habitatPkmnNum}" class="subcat-cell blank"></td>` : ''}
                    <td>${renderMonData(monData)}</td>
                </tr>`
            }).join('');
        } else {
            return Object.entries(habitatContent).map(([subcatName, mons], habitatIndex) => {
                const num = mons.length
                const habitatFirst = habitatIndex === 0
                return mons.map((monData, index) => {
                    const first = index === 0
                    return /*html*/`<tr>
                        ${(locFirst && habitatFirst && first) ? /*html*/`<td rowspan="${pkmnNum}" class="area-cell">${location}</td>` : ''}
                        ${(habitatFirst && first) ? /*html*/`<td rowspan="${habitatPkmnNum}" class="habitat-cell">${habitatName}</td>` : ''}
                        ${(first) ? /*html*/`<td rowspan="${num}" class="subcat-cell">${subcatName}</td>` : ''}
                        <td>${renderMonData(monData)}</td>
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
}