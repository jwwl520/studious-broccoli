// script.js

// 全局变量
let contentData = [];
let srtData = [];
let selectedIndex = -1; 
let currentBatchEditColumnIndex = -1; 

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    initializeTable();
    initializeFileHandlers();
    initializePasteHandler();
    initializeModal(); 
    
    const srtSearchInput = document.getElementById('srt-search-input');
    if (srtSearchInput) {
        srtSearchInput.addEventListener('input', searchSrt);
    }
});

function initializeModal() {
    const modal = document.getElementById('batch-edit-modal');
    window.onclick = function(event) {
        if (event.target == modal) {
            closeBatchEditModal();
        }
    }
}

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            const activeTabContent = document.getElementById(`${button.dataset.tab}-tab`);
            if (activeTabContent) {
                activeTabContent.classList.add('active');
            }
            if (button.dataset.tab === 'replace' && srtData.length > 0) {
                updateSrtView();
            } else if (button.dataset.tab === 'edit') {
                updateRowNumbers(); 
            }
        });
    });
}

function initializeTable() {
    const initialRowCount = 10;
    const tbody = document.getElementById('table-body');
    if(tbody) {
        for (let i = 0; i < initialRowCount; i++) {
            addRowToTable();
        }
    }
}

function addRowToTable(speaker = '', chinese = '', originalJapanese = '', modifiedJapanese = '') {
    const tbody = document.getElementById('table-body');
    if(!tbody) return;

    const rowCount = tbody.rows.length + 1;
    const row = tbody.insertRow(); 
    // 修改单元格内删除按钮的onclick事件和title
    row.innerHTML = `
        <td class="row-number">${rowCount}</td>
        <td><div class="cell-content-wrapper"><input type="text" placeholder="说话人" value="${escapeHTML(speaker)}"><button class="cell-delete-btn" onclick="clearCellContent(this)" title="清空此单元格"><i class="fas fa-times-circle"></i></button></div></td>
        <td><div class="cell-content-wrapper"><input type="text" placeholder="中文字幕" value="${escapeHTML(chinese)}"><button class="cell-delete-btn" onclick="clearCellContent(this)" title="清空此单元格"><i class="fas fa-times-circle"></i></button></div></td>
        <td><div class="cell-content-wrapper"><input type="text" placeholder="原日语字幕" value="${escapeHTML(originalJapanese)}"><button class="cell-delete-btn" onclick="clearCellContent(this)" title="清空此单元格"><i class="fas fa-times-circle"></i></button></div></td>
        <td><div class="cell-content-wrapper"><input type="text" placeholder="改日语字幕" value="${escapeHTML(modifiedJapanese)}"><button class="cell-delete-btn" onclick="clearCellContent(this)" title="清空此单元格"><i class="fas fa-times-circle"></i></button></div></td>
        <td class="action-cell"><button class="delete-row-btn" onclick="deleteRow(this)" title="删除此行"><i class="fas fa-trash-alt"></i></button></td>
    `;
    
    const inputs = row.querySelectorAll('input[type="text"]');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            autoAdjustInputHeight(this);
        });
        autoAdjustInputHeight(input); 
    });
    return row;
}

// 新增：清空单元格内容函数
function clearCellContent(buttonElement) {
    const wrapper = buttonElement.closest('.cell-content-wrapper');
    if (wrapper) {
        const inputField = wrapper.querySelector('input[type="text"]');
        if (inputField) {
            inputField.value = '';
            autoAdjustInputHeight(inputField); // 清空后可能需要调整高度
            saveTable(); // 保存更改
            showToast('单元格内容已清空');
        }
    }
}


function addRow() {
    addRowToTable(); 
    saveTable(); 
    updateRowNumbers(); 
}


function autoAdjustInputHeight(inputElement) {
    inputElement.style.height = 'auto'; 
    inputElement.style.height = (inputElement.scrollHeight < 30 ? 30 : inputElement.scrollHeight) + 'px';
}


function addRows(count) {
    for (let i = 0; i < count; i++) {
        addRowToTable(); 
    }
    saveTable(); 
    updateRowNumbers(); 
}

// deleteRow 函数保持不变，用于删除整行
function deleteRow(buttonElement) {
    const rowToDelete = buttonElement.closest('tr');
    if (rowToDelete) {
        const tbody = document.getElementById('table-body');
        const rowIndex = Array.from(tbody.children).indexOf(rowToDelete);

        if (rowIndex > -1 && contentData[rowIndex]) { // 确保索引有效且contentData中有对应项
            contentData.splice(rowIndex, 1);
        }
        
        rowToDelete.remove();
        updateRowNumbers(); 
        saveTable(); 
        showToast("行已删除");
    }
}

function updateRowNumbers() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    rows.forEach((row, index) => {
        const rowNumberCell = row.querySelector('.row-number');
        if (rowNumberCell) {
            rowNumberCell.textContent = index + 1;
        }
    });
}


function clearTable() {
    if (confirm('确定要清空所有内容吗？此操作不可撤销！')) {
        const tbody = document.getElementById('table-body');
        if (tbody) {
            tbody.innerHTML = '';
        }
        contentData = []; 
        addRows(5); 
        showToast("表格已清空");
    }
}

function initializePasteHandler() {
    const tableContainer = document.querySelector('#edit-tab .table-container'); 
    if (!tableContainer) return;

    tableContainer.addEventListener('paste', function(e) {
        const focusedElement = document.activeElement;
        if (!focusedElement || !focusedElement.matches('#content-table input')) return;
        
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text/plain');
        if (!pasteData) return;
        
        const currentCell = focusedElement.closest('td');
        const currentRow = currentCell.closest('tr');
        const tbody = currentRow.closest('tbody');
        
        const cellsInRow = Array.from(currentRow.cells);
        let currentInputIndex = cellsInRow.indexOf(currentCell) - 1; 
        if (currentInputIndex < 0) currentInputIndex = 0; 

        const currentRowIndex = Array.from(tbody.rows).indexOf(currentRow);
        
        const rowsFromPaste = pasteData.split(/[\r\n]+/).filter(rowText => rowText.trim() !== '');
        
        rowsFromPaste.forEach((rowData, rowOffset) => {
            let cellsData;
            if (rowData.includes('\t')) {
                cellsData = rowData.split('\t');
            } else {
                cellsData = parseCSVLine(rowData); 
            }
            
            const targetRowIndex = currentRowIndex + rowOffset;
            let targetRowElement = tbody.rows[targetRowIndex];

            if (!targetRowElement) { 
                targetRowElement = addRowToTable(); 
            }
            
            const inputsInTargetRow = targetRowElement.querySelectorAll('input[type="text"]');

            cellsData.forEach((cellData, cellOffset) => {
                const targetInputIndex = currentInputIndex + cellOffset;
                if (targetInputIndex >= 0 && targetInputIndex < inputsInTargetRow.length) { 
                    const targetInput = inputsInTargetRow[targetInputIndex];
                    if (targetInput) {
                        targetInput.value = cellData.trim();
                        autoAdjustInputHeight(targetInput);
                    }
                }
            });
        });
        updateRowNumbers(); 
        saveTable(); 
    });
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && (i === 0 || line[i-1] !== '"')) {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    return result;
}

function saveTable() {
    const tableBody = document.getElementById('table-body');
    if (!tableBody) return;

    const rows = tableBody.querySelectorAll('tr');
    const newContentData = []; 

    rows.forEach(row => {
        const inputs = row.querySelectorAll('input[type="text"]');
        if (inputs.length === 4) { 
            newContentData.push({
                speaker: inputs[0].value,
                chinese: inputs[1].value,
                originalJapanese: inputs[2].value,
                modifiedJapanese: inputs[3].value
            });
        }
    });
    contentData = newContentData; 
}

function exportTable() {
    saveTable(); 
    
    if (contentData.length === 0) {
        showToast('没有内容可导出！', 'warning');
        return;
    }

    let csv = '\uFEFF'; 
    csv += '说话人,中文字幕,原日语字幕,改日语字幕\n'; 
    contentData.forEach(row => {
        const escapedValues = [
            escapeCSVValue(row.speaker),
            escapeCSVValue(row.chinese),
            escapeCSVValue(row.originalJapanese),
            escapeCSVValue(row.modifiedJapanese)
        ];
        csv += escapedValues.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '字幕编辑内容.csv';
    document.body.appendChild(link); 
    link.click();
    document.body.removeChild(link); 
    URL.revokeObjectURL(link.href);
    showToast('CSV文件已导出');
}

function escapeCSVValue(value) {
    if (value === null || typeof value === 'undefined') return '';
    value = String(value);
    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
        return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
}

function importFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                loadCSVContent(event.target.result);
            };
            reader.readAsText(file, 'UTF-8'); 
        }
    };
    input.click();
}

function loadCSVContent(csvContent) {
    const lines = csvContent.split(/[\r\n]+/).filter(line => line.trim() !== '');
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = ''; 
    contentData = [];

    const startLine = (lines[0] && (lines[0].includes('说话人') || lines[0].toLowerCase().includes('speaker'))) ? 1 : 0;

    for (let i = startLine; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue; 
        const values = parseCSVLine(line);
        addRowToTable(values[0] || '', values[1] || '', values[2] || '', values[3] || '');
    }
    updateRowNumbers(); 
    saveTable(); 
    showToast(`文件已导入成功！共导入 ${tbody.rows.length} 行数据。`);
}


function escapeHTML(str) {
    if (typeof str !== 'string') str = String(str); 
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function initializeFileHandlers() {
    const srtFileInput = document.getElementById('srt-file');
    if (srtFileInput) {
        srtFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    loadSrtFile(event.target.result);
                    const srtStatus = document.getElementById('srt-status');
                    if (srtStatus) srtStatus.textContent = `已加载: ${file.name}`;
                };
                reader.readAsText(file, 'UTF-8');
            }
        });
    }
    
    // 新增：编辑功能页的SRT文件输入监听
    const editSrtFileInput = document.getElementById('edit-srt-file');
    if (editSrtFileInput) {
        editSrtFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    loadSrtToEditTab(event.target.result, file.name);
                };
                reader.readAsText(file, 'UTF-8');
            }
        });
    }
}

// 新增：SRT导入到编辑功能页面的函数
function importSrtToEdit() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.srt';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                loadSrtToEditTab(event.target.result, file.name);
            };
            reader.readAsText(file, 'UTF-8');
        }
    };
    input.click();
}

// 新增：加载SRT到编辑功能页面的函数
function loadSrtToEditTab(srtContentString, fileName) {
    // 解析SRT文件
    const parsedSrt = parseSrt(srtContentString);
    
    // 保存到全局srtData变量以便与SRT替换页面共享
    srtData = parsedSrt;
    
    // 获取表格主体
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    
    // 清空表格
    tbody.innerHTML = '';
    contentData = [];
    
    // 将SRT文件内容填充到表格
    parsedSrt.forEach(srtItem => {
        // 只填充台词内容到D列（第4列，改日语字幕）
        addRowToTable('', '', '', srtItem.content);
    });
    
    // 更新行号
    updateRowNumbers();
    
    // 保存表格数据
    saveTable();
    
    // 显示成功消息
    showToast(`SRT文件"${fileName}"已导入！共导入 ${parsedSrt.length} 条字幕到D列。`);
    
    // 更新SRT状态（如果在替换页面也显示状态）
    const srtStatus = document.getElementById('srt-status');
    if (srtStatus) {
        srtStatus.textContent = `已加载: ${fileName}`;
    }
}

// SRT相关功能
function loadSrtFile(srtContentString) {
    srtData = parseSrt(srtContentString);
    saveTable(); 
    displaySrtContent(); 
}

function parseSrt(srtContent) {
    const entries = [];
    const blocks = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split(/\n\n+/);

    blocks.forEach(block => {
        if (block.trim() === "") return;
        const lines = block.split('\n');
        if (lines.length < 2) return; 

        const indexStr = lines[0].trim();
        const timeStr = lines[1].trim();
        const textContent = lines.slice(2).join('\n').trim();

        if (/^\d+$/.test(indexStr) && /-->/.test(timeStr)) {
            entries.push({ index: indexStr, time: timeStr, content: textContent });
        } else {
            console.warn("Skipping invalid SRT block:", block);
        }
    });
    return entries;
}

function displaySrtContent() {
    const tbody = document.getElementById('srt-table-body');
    if (!tbody) return;
    tbody.innerHTML = ''; 

    if (!srtData || srtData.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 3;
        cell.textContent = '请上传有效的SRT文件，或SRT文件内容为空。';
        cell.style.textAlign = 'center';
        return;
    }
    
    srtData.forEach((srtItem, srtIndexInArray) => {
        const row = tbody.insertRow();
        row.className = 'srt-row';
        row.onclick = () => selectSrtRow(srtIndexInArray); 
        
        const modifiedJpContent = contentData[srtIndexInArray]?.modifiedJapanese || '';
        
        row.innerHTML = `
            <td class="srt-modified">${escapeHTML(modifiedJpContent)}</td>
            <td class="srt-time">
                <span class="srt-index">#${escapeHTML(srtItem.index)}</span><br>
                ${escapeHTML(srtItem.time)}
            </td>
            <td class="srt-content">${escapeHTML(srtItem.content)}</td>
        `;
    });
}

function selectSrtRow(indexInSrtArray) {
    const rows = document.querySelectorAll('#srt-table-body .srt-row');
    rows.forEach(row => row.classList.remove('selected'));
    
    const selectedRow = rows[indexInSrtArray];
    if (selectedRow) {
        selectedRow.classList.add('selected');
        selectedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    selectedIndex = indexInSrtArray; 
}

function updateSrtView() {
    if (srtData.length > 0) {
        saveTable();
        displaySrtContent();
    }
}

function replaceSubtitles() {
    if (srtData.length === 0) {
        showToast('请先上传SRT文件！', 'warning');
        return;
    }
    saveTable(); 

    let replacedCount = 0;
    let actuallyChangedCount = 0;

    srtData.forEach((srtItem, index) => {
        if (contentData[index] && typeof contentData[index].modifiedJapanese === 'string') {
            const oldSrtContent = srtItem.content;
            const newSrtContent = contentData[index].modifiedJapanese;
            
            srtItem.content = newSrtContent;
            replacedCount++; 

            if (oldSrtContent !== newSrtContent) {
                actuallyChangedCount++; 
            }
        }
    });

    displaySrtContent(); 
    showToast(`替换操作完成！${replacedCount} 条字幕已根据D列更新，其中 ${actuallyChangedCount} 条内容发生改变。`);
}


function exportSrt() {
    if (srtData.length === 0) {
        showToast('没有可导出的SRT内容！', 'warning');
        return;
    }

    let srtOutput = '';
    srtData.forEach((item) => {
        srtOutput += `${item.index}\n`;
        srtOutput += `${item.time}\n`;
        srtOutput += `${item.content}\n\n`; 
    });

    const blob = new Blob(['\uFEFF' + srtOutput.trimEnd()], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '字幕_已替换.srt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('SRT文件已导出');
}

function searchSrt() {
    const srtSearchInput = document.getElementById('srt-search-input');
    if(!srtSearchInput) return;
    const searchTerm = srtSearchInput.value.toLowerCase();
    const rows = document.querySelectorAll('#srt-table-body .srt-row');

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let rowTextContent = '';
        if (cells.length === 3) { 
            rowTextContent = (cells[0].textContent + ' ' + cells[1].textContent + ' ' + cells[2].textContent).toLowerCase();
        } else { 
            rowTextContent = row.textContent.toLowerCase();
        }
        row.style.display = rowTextContent.includes(searchTerm) || searchTerm === '' ? '' : 'none';
    });
}

function clearSrtSearch() {
    const srtSearchInput = document.getElementById('srt-search-input');
    if (srtSearchInput) {
        srtSearchInput.value = '';
    }
    const rows = document.querySelectorAll('#srt-table-body .srt-row');
    rows.forEach(row => {
        row.style.display = '';
    });
}

function copyColumn(columnIndex) {
    saveTable(); 
    const tbody = document.getElementById('table-body');
    if (!tbody || contentData.length === 0) {
        showToast('表格中没有数据可复制', 'warning');
        return;
    }

    let columnText = '';
    const columnKeys = ['speaker', 'chinese', 'originalJapanese', 'modifiedJapanese'];
    const keyToCopy = columnKeys[columnIndex];

    if (!keyToCopy) {
        showToast('无效的列索引', 'error');
        return;
    }

    contentData.forEach(rowData => {
        columnText += (rowData[keyToCopy] || '') + '\n';
    });

    columnText = columnText.trimEnd(); 

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(columnText).then(() => {
            showToast('列内容已复制到剪贴板！');
        }).catch(err => {
            console.error('复制失败: ', err);
            showToast('复制失败，请检查浏览器权限或手动复制。', 'error');
            fallbackCopyTextToClipboard(columnText); 
        });
    } else {
        fallbackCopyTextToClipboard(columnText); 
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; 
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em"; 
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast('列内容已通过备用方式复制！');
        } else {
            showToast('复制失败，请尝试手动复制。', 'error');
        }
    } catch (err) {
        console.error('备用复制失败: ', err);
        showToast('复制失败，请尝试手动复制。', 'error');
    }
    document.body.removeChild(textArea);
}


function showToast(message, type = 'success') { 
    const toast = document.getElementById('toast-notification');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast-notification show'; 

    if (type === 'error') {
        toast.style.backgroundColor = '#dc3545'; 
    } else if (type === 'warning') {
        toast.style.backgroundColor = '#ffc107'; 
        toast.style.color = '#212529'; 
    } else { 
        toast.style.backgroundColor = '#198754'; 
        toast.style.color = 'white';
    }

    setTimeout(() => {
        toast.className = 'toast-notification';
        toast.style.color = 'white'; 
    }, 3000); 
}


// --- 列批量编辑模态框功能 ---
function openBatchEditModal(columnIndex) {
    saveTable(); 
    currentBatchEditColumnIndex = columnIndex; 
    const modal = document.getElementById('batch-edit-modal');
    const textarea = document.getElementById('batch-edit-textarea');
    const modalTitle = document.getElementById('batch-edit-modal-title');
    
    const columnHeaders = ["说话人 (A列)", "中文字幕 (B列)", "原日语字幕 (C列)", "改日语字幕 (D列)"];
    const columnKeys = ['speaker', 'chinese', 'originalJapanese', 'modifiedJapanese'];
    const keyToEdit = columnKeys[columnIndex];

    if (!keyToEdit) {
        showToast('无效的列用于批量编辑', 'error');
        return;
    }

    modalTitle.textContent = `批量编辑：${columnHeaders[columnIndex]}`;
    
    let columnText = '';
    contentData.forEach(rowData => {
        columnText += (rowData[keyToEdit] || '') + '\n';
    });
    textarea.value = columnText.trimEnd();
    
    modal.style.display = "block";
    textarea.focus();
}

function closeBatchEditModal() {
    const modal = document.getElementById('batch-edit-modal');
    modal.style.display = "none";
    currentBatchEditColumnIndex = -1; 
}

function applyBatchEdit() {
    if (currentBatchEditColumnIndex === -1) return;

    const textarea = document.getElementById('batch-edit-textarea');
    const lines = textarea.value.split('\n');
    const columnKeys = ['speaker', 'chinese', 'originalJapanese', 'modifiedJapanese'];
    const keyToUpdate = columnKeys[currentBatchEditColumnIndex];

    const tableBody = document.getElementById('table-body');
    const tableRows = tableBody.querySelectorAll('tr');

    const numRowsToUpdate = Math.min(tableRows.length, lines.length);

    for (let i = 0; i < numRowsToUpdate; i++) {
        const inputField = tableRows[i].querySelectorAll('input[type="text"]')[currentBatchEditColumnIndex];
        if (inputField) {
            inputField.value = lines[i] || ''; 
            autoAdjustInputHeight(inputField); 
        }
    }
    
    if (lines.length > tableRows.length) {
        showToast(`提示：批量编辑的文本行数 (${lines.length}) 多于表格行数 (${tableRows.length})，多余的文本未添加为新行。`, 'warning');
    }


    saveTable(); 
    updateRowNumbers(); 
    showToast('列内容已批量更新！');
    closeBatchEditModal();
}


// Auto-save for the edit tab's contentData
let autoSaveTimer;
const editTab = document.getElementById('edit-tab');

const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        if (mutation.attributeName === 'class') {
            const isActive = editTab && editTab.classList.contains('active');
            if (isActive) {
                if (!autoSaveTimer) { 
                    autoSaveTimer = setInterval(saveTable, 5000); 
                }
            } else {
                if (autoSaveTimer) { 
                    clearInterval(autoSaveTimer);
                    autoSaveTimer = null;
                }
            }
        }
    });
});

if (editTab) { 
    observer.observe(editTab, { attributes: true });
    if (editTab.classList.contains('active')) {
       if (!autoSaveTimer) autoSaveTimer = setInterval(saveTable, 5000);
    }
}


window.addEventListener('beforeunload', () => {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
    }
    if(observer) observer.disconnect(); 
});