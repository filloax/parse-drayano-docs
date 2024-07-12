import os
import re
from tqdm import tqdm
from typing import TypedDict
import json
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.path.pardir))
WILD_AREA_FILE_DEFAULT = os.path.join(os.path.dirname(__file__), 'data', 'Wild Area Changes.txt')

SECTION_SEP_PATTERN = r'===+'
SECTION_FILES = {
    'main story': 'main',
    'postgame locations': 'postgame',
    'hidden grotto guide': 'hidden_grotto',
}

class Sections(TypedDict):
    main: str
    postgame: str
    hidden_grotto: str

def split_sections(filename, dir) -> Sections:
    """Remove heading from text in filename and save sections to some files (returned as dict)"""
    with open(filename, 'r', encoding='utf-8') as file:
        files = {}
        is_sname = False
        current_file = None
        for line in tqdm(file, desc='Split sections'):
            line = line.strip()
            if re.match(SECTION_SEP_PATTERN, line):
                is_sname = not is_sname
            elif is_sname:
                current_filename = SECTION_FILES.get(line.lower(), None)
                if current_file is not None:
                    current_file.close()
                if current_filename is not None:
                    fname_full = os.path.join(dir, f'{current_filename}.txt')
                    current_file = open(fname_full, 'w', encoding='utf-8')
                    files[current_filename] = fname_full
            elif current_file is not None:
                current_file.write(f"{line}\n")
                
    return files

TWO_COLUMN_START_PATTERN = r'^(.+?):\s+(.+?):$'
SINGLE_COLUMN_START_PATTERN = r'^(.+?):$'
TWO_COLUMN_SEP_PATTERN = r'---+\s+---+'
TWO_COLUMN_CONTENT_PATTERN = r'^(.*?)\s\s\s+(.*?)$' # one column might be empty here (shorter)
# For instance: "Surf, Normal:                            Surf, Dark Spot:"

def decolumn_file(filename: str) -> str:
    """Convert file to remove two-column alignments, return converted filename"""
    with open(filename, 'r', encoding='utf-8') as file:
        fsplit = filename.split('.')
        outfile = '.'.join(fsplit[:-1]) + "_decolumn." + fsplit[-1]
        name = os.path.basename(filename)
        
        in_two_column = False
        colbuffers = ['', '']
        
        with open(outfile, 'w', encoding='utf-8') as out:
            for line in tqdm(file,  desc=f'Decolumn {name}', postfix=f'2 column: {in_two_column}'):
                # do not strip line to detect empty columns
                two_column_start_match = re.match(TWO_COLUMN_START_PATTERN, line)
                if two_column_start_match and not in_two_column:
                    in_two_column = True
                    colbuffers[0] += two_column_start_match.group(1) + '\n'
                    colbuffers[1] += two_column_start_match.group(2) + '\n'
                elif in_two_column:
                    two_column_content_match = re.match(TWO_COLUMN_CONTENT_PATTERN, line)
                    if re.search(TWO_COLUMN_SEP_PATTERN, line):
                        colbuffers[0] += '----------------------------------------\n'
                        colbuffers[1] += '----------------------------------------\n'
                    elif two_column_content_match is not None: #empty first column or both columns
                        col_left = two_column_content_match.group(1)
                        col_right = two_column_content_match.group(2)
                        colbuffers[0] += col_left + '\n'
                        colbuffers[1] += col_right + '\n'
                    elif line.strip() == '': #blank line, assume all two column segments have a blank line interrupting them
                        for buffer in colbuffers:
                            out.write(buffer)
                            out.write('\n')
                        colbuffers = ['', '']
                        in_two_column = False
                    else: #empty second column
                        col_left = line.strip()
                        colbuffers[0] += col_left + '\n'
                else:
                    out.write(line)

    return outfile

AREA_NAME_PATTERN = r'~~~+\s*(?P<name>.+?)\s*~~~+'
CATEGORY_PATTERN = r'(?P<main>[^,]+)(?:,\s*(?P<kind>.+?))?\s*:?$' # only for getting, not checking as works with any string
CATEGORY_SEP_PATTERN = r'----+'

def parse_wild_area_section(section_filename):
    name = os.path.basename(section_filename)
    
    data = {}
    current_location = ""
    current_category = ""
    current_subcategory = None
    current_entries = []
    # This needs lookbehind of two lines, to detect categories as strings followed by ------. Sigh.
    # Two elements, [last one, second-to-last]
    buffer = []

    def insert_current():
        nonlocal current_entries, current_location, current_category, current_subcategory

        if current_location == '' or current_category == '': return

        while len(buffer) > 0:
            check_old_line(buffer.pop(), current_entries)
        
        if current_location not in data:
            data[current_location] = {}
        if current_category not in data[current_location] and current_subcategory is not None:
            data[current_location][current_category] = {}
        if current_subcategory is None:
            if current_category not in data[current_location]:
                data[current_location][current_category] = current_entries.copy()
            else:
                union_in_place(data[current_location][current_category], current_entries)
        else:
            if current_subcategory not in data[current_location][current_category]:
                data[current_location][current_category][current_subcategory] = current_entries.copy()
            else:
                union_in_place(data[current_location][current_category][current_subcategory], current_entries)

    with open(section_filename, 'r', encoding='utf-8') as file:
        # for line in file:
        for line in tqdm(file,  desc=f'Parse section {name}'):
            line = line.strip()
            
            insert_in_buffer = True
            
            area_match = re.match(AREA_NAME_PATTERN, line)
            if area_match:
                insert_current()
                current_entries = []
                current_location = area_match.group('name')
                insert_in_buffer = False
            elif line == "" and current_location != "" and current_category != "":
                insert_in_buffer = False
                # insert_current()
            elif re.match(CATEGORY_SEP_PATTERN, line) and len(buffer) > 0:
                # Is category sep, then last line was category
                category_line = buffer.pop(0)
                insert_in_buffer = False
                category_match = re.match(CATEGORY_PATTERN, category_line)

                insert_current()

                current_category = category_match.group('main')
                current_subcategory = category_match.group('kind')
                current_entries = []
                
            if insert_in_buffer:
                buffer.insert(0, line)  
                if len(buffer) > 1:
                    # When sure that they are not categories, parse entries
                    check_old_line(buffer.pop(), current_entries)

    insert_current()
    remove_empty_from_dict(data)

    return data

def union_in_place(list1: list, list2: list):
    list1.extend([x for x in list2 if x not in list1])

# Pidove Lv. 05-07 20%
ENC_PATTERN = r'(?P<mon>.+?)\s+Lv.\s+(?P<lvmin>\d+)(?:-(?P<lvmax>\d+))?(?:\s+(?P<notes>.+))?\s+(?P<pct>[\d-]+)%'

def check_old_line(line: str, current_entries: []):
    if re.match(ENC_PATTERN, line):
        entry = parse_encounter_entry(line)
        if entry is not None:
            current_entries.append(entry)      

class Encounter(TypedDict):
    pokemon: str
    level_range: tuple[int, int]
    chance_pct: int | None
    notes: str | None

debug_hidden_grottos_entries = False

def parse_encounter_entry(entry: str) -> Encounter | None:
    global debug_hidden_grottos_entries
    
    if entry.strip() == '':
        return None
    if not debug_hidden_grottos_entries and "Search 'Hidden Grotto Guide'" in entry:
        return None
        
    match = re.search(ENC_PATTERN, entry)
    if match is not None:
        return {
            'pokemon': match.group('mon'),
            'chance_pct': int_or_none(match.group('pct')),
            'level_range': (
                int(match.group('lvmin')),
                int(match.group('lvmax') or match.group('lvmin')),
            ),
            'notes': match.group('notes'),
        }
    else:
        print(f"Warning: entry {entry} is not valid")
        return None
    
def remove_empty_from_dict(data: dict):
    # Remove empty
    locations = list(data.keys())
    for location in locations:
        categories = list(data[location].keys())
        for category in categories:
            if type(data[location][category]) is dict:
                subcategories = list(data[location][category].keys())
                for subcategory in subcategories:
                    if len(data[location][category][subcategory]) == 0:
                        del data[location][category][subcategory]
                        continue
            if len(data[location][category]) == 0:
                del data[location][category]
                continue

        if len(data[location]) == 0:
            del data[location]
            continue

    
LIST_START_PATTERN = r'^(?P<category>.+?):'
LIST_ENTRY_PATTERN = r'^-\s+(?P<entry>.+)'
    
def parse_hidden_grotto_file(filename):
    name = os.path.basename(filename)
    
    current_location = ''
    current_category = ''
    current_entries = []
    data = {}
    
    with open(filename, 'r', encoding='utf-8') as file:
        for line in tqdm(file,  desc=f'Parse hg section {name}'):
            line = line.strip()
            
            area_match = re.match(AREA_NAME_PATTERN, line)
            list_start_match = re.match(LIST_START_PATTERN, line)
            entry_match = re.match(LIST_ENTRY_PATTERN, line)
            if area_match:
                if current_category != '' and current_location != '':
                    if current_location not in data:
                        data[current_location] = {}
                    data[current_location][current_category] = current_entries
                    current_entries = []

                current_location = area_match.group('name')
            elif line == '':
                continue
            elif list_start_match:
                if current_category != '' and current_location != '':
                    if current_location not in data:
                        data[current_location] = {}
                    data[current_location][current_category] = current_entries
                    current_entries = []

                current_category = list_start_match.group('category')
            elif entry_match:
                current_entries.append(parse_hidden_grotto_entry(entry_match.group('entry')))
         
    set_hardcoded_entries(data)
       
    return data

def set_hardcoded_entries(data: dict):
    data['Route 5']['Guaranteed Encounters'] = [{
        'pokemon': 'Stantler',
        'level': 30,
        'forcedFirst': True,
    }]

def parse_hidden_grotto_entry(entry: str):
    return entry

def int_or_none(x):
    try:
        return int(x)
    except ValueError:
        return None

def work(original_file, workdir, outdir):
    files = split_sections(original_file, workdir)
    
    for file in files:
        full_filename = files[file]
        decolumn = decolumn_file(full_filename)
        if file == 'hidden_grotto':
            data = parse_hidden_grotto_file(decolumn)
        else:
            data = parse_wild_area_section(decolumn)
        
        json_name = os.path.join(outdir, f'{file}.json')
        with open(json_name, 'w', encoding='utf-8') as out:
            json.dump(data, out, indent=2, ensure_ascii=False)

def main():
    script_dir = os.path.dirname(__file__)
    data_dir = os.path.join(script_dir, 'data')
    out_dir = os.path.join(script_dir, 'static/data')
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)
    if len(sys.argv) > 1:
        file = sys.argv[1]
    else:
        file = WILD_AREA_FILE_DEFAULT
    work(file, data_dir, out_dir)
    print(f"Done!")

if __name__ == '__main__':
    main()