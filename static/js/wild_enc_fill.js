document.addEventListener("DOMContentLoaded", function() {
    let dataPath = `data/main.json`
    if (typeof getDataPath === 'function') {
        dataPath = getDataPath()
    } else {
        console.log(`getDataPath function not defined in template, will use ${dataPath} as default`)
    }
    const table = document.getElementById('main-table')
    fetch(dataPath).then(response => response.json().then(data => {
        table.innerHTML = Object.entries(data).map(([location, habitatMap]) => 
            renderLocationData(location, habitatMap)
        ).join('');
    }));
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