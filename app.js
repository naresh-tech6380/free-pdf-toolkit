(function () {
      'use strict';
      var state = { merge: [], split: [], images: [], compress: [], rotate: [], pdfimages: [] };
      var generatedImageUrls = [];
      var $ = function (id) { return document.getElementById(id); };
      var icons = {
        up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m6 15 6-6 6 6"/></svg>',
        down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m6 9 6 6 6-6"/></svg>',
        remove: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 5l14 14M19 5 5 19"/></svg>'
      };

      if (!window.PDFLib || !window.pdfjsLib) {
        $('lib-error').style.display = 'block';
      } else {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      document.querySelectorAll('.tool-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          document.querySelectorAll('.tool-tab').forEach(function (item) { item.classList.remove('active'); item.setAttribute('aria-selected', 'false'); });
          document.querySelectorAll('.panel').forEach(function (item) { item.classList.remove('active'); });
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');
          document.querySelector('[data-panel="' + tab.dataset.tool + '"]').classList.add('active');
        });
      });

      document.querySelectorAll('.dropzone').forEach(function (zone) {
        var input = $(zone.dataset.input);
        zone.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
        });
        ['dragenter', 'dragover'].forEach(function (name) {
          zone.addEventListener(name, function (event) { event.preventDefault(); zone.classList.add('dragging'); });
        });
        ['dragleave', 'drop'].forEach(function (name) {
          zone.addEventListener(name, function (event) { event.preventDefault(); zone.classList.remove('dragging'); });
        });
        zone.addEventListener('drop', function (event) {
          handleFiles(input.id, Array.prototype.slice.call(event.dataTransfer.files));
        });
        input.addEventListener('change', function () {
          handleFiles(input.id, Array.prototype.slice.call(input.files));
          input.value = '';
        });
      });

      function prettySize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
      }
      function safePdfName(name, fallback) {
        var clean = String(name || fallback).trim().replace(/[\\/:*?"<>|]/g, '-');
        if (!clean) clean = fallback;
        return /\.pdf$/i.test(clean) ? clean : clean + '.pdf';
      }
      function setStatus(tool, message, type, busy) {
        var el = $(tool + '-status');
        el.className = 'status' + (type ? ' ' + type : '');
        el.innerHTML = (busy ? '<span class="spinner" aria-hidden="true"></span>' : '') + '<span>' + message + '</span>';
      }
      function downloadBlob(blob, name) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url; link.download = name;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1200);
        return blob.size;
      }
      function downloadBytes(bytes, name) {
        return downloadBlob(new Blob([bytes], { type: 'application/pdf' }), name);
      }
      function accepted(file, kind) {
        if (kind === 'images') return /^image\/(jpeg|png|webp)$/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
        return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      }
      function handleFiles(inputId, files) {
        var tool = inputId.split('-')[0];
        var valid = files.filter(function (file) { return accepted(file, tool); });
        if (!valid.length) { setStatus(tool, tool === 'images' ? 'Choose JPG, PNG, or WebP images.' : 'Choose a PDF file.', 'error'); return; }
        if (tool === 'split' || tool === 'compress' || tool === 'rotate' || tool === 'pdfimages') state[tool] = [valid[0]];
        else state[tool] = state[tool].concat(valid);
        renderList(tool);
        if (tool === 'split' || tool === 'rotate' || tool === 'pdfimages') readPageCount(valid[0], tool);
        else setStatus(tool, state[tool].length + (state[tool].length === 1 ? ' file ready' : ' files ready'), '', false);
      }
      function renderList(tool) {
        var list = $(tool + '-list');
        list.innerHTML = '';
        state[tool].forEach(function (file, index) {
          var row = document.createElement('div'); row.className = 'file-row';
          var badge = document.createElement('div'); badge.className = 'file-badge'; badge.textContent = tool === 'images' ? 'IMG' : 'PDF';
          var meta = document.createElement('div'); meta.className = 'file-meta';
          var fileName = document.createElement('div'); fileName.className = 'file-name'; fileName.textContent = file.name;
          var size = document.createElement('div'); size.className = 'file-size'; size.textContent = prettySize(file.size);
          meta.appendChild(fileName); meta.appendChild(size);
          var actions = document.createElement('div'); actions.className = 'row-actions';
          if ((tool === 'merge' || tool === 'images') && state[tool].length > 1) {
            actions.appendChild(makeIconButton('Move up', icons.up, function () { moveFile(tool, index, -1); }, index === 0));
            actions.appendChild(makeIconButton('Move down', icons.down, function () { moveFile(tool, index, 1); }, index === state[tool].length - 1));
          }
          actions.appendChild(makeIconButton('Remove', icons.remove, function () { state[tool].splice(index, 1); renderList(tool); setStatus(tool, state[tool].length ? state[tool].length + ' file' + (state[tool].length === 1 ? '' : 's') + ' ready' : '', '', false); }, false));
          row.appendChild(badge); row.appendChild(meta); row.appendChild(actions); list.appendChild(row);
        });
        var has = state[tool].length > 0;
        $(tool + '-clear').hidden = !has;
        $(tool + '-action').disabled = tool === 'merge' ? state.merge.length < 2 : !has;
      }
      function makeIconButton(label, svg, action, disabled) {
        var button = document.createElement('button'); button.className = 'icon-btn'; button.type = 'button'; button.setAttribute('aria-label', label); button.title = label; button.innerHTML = svg; button.disabled = disabled; button.addEventListener('click', action); return button;
      }
      function moveFile(tool, index, direction) {
        var target = index + direction;
        if (target < 0 || target >= state[tool].length) return;
        var item = state[tool].splice(index, 1)[0]; state[tool].splice(target, 0, item); renderList(tool);
      }
      ['merge', 'split', 'images', 'compress', 'rotate', 'pdfimages'].forEach(function (tool) {
        $(tool + '-clear').addEventListener('click', function () {
          state[tool] = []; renderList(tool); setStatus(tool, '', '', false);
          if (tool === 'split') $('page-range').value = '';
          if (tool === 'rotate') $('rotate-pages').value = 'all';
          if (tool === 'pdfimages') clearGeneratedImages();
        });
      });

      async function readPageCount(file, tool) {
        if (!window.PDFLib) return;
        try {
          setStatus(tool, 'Reading pages…', '', true);
          var bytes = await file.arrayBuffer();
          var doc = await window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: false });
          file._pageCount = doc.getPageCount();
          if (tool === 'split') $('page-range').placeholder = 'Example: 1-' + file._pageCount;
          if (tool === 'rotate') $('rotate-pages').placeholder = 'all or 1-' + file._pageCount;
          setStatus(tool, file._pageCount + ' pages found', 'success', false);
        } catch (error) { setStatus(tool, friendlyError(error), 'error', false); }
      }
      function friendlyError(error) {
        var text = String(error && error.message || error || 'Unknown error');
        if (/encrypt|password/i.test(text)) return 'This PDF is password-protected. Unlock it first and try again.';
        if (/invalid|parse|header|xref/i.test(text)) return 'This file does not appear to be a valid PDF.';
        return 'Could not process this file. Try another PDF.';
      }
      function parseRanges(text, total) {
        var cleaned = text.trim().toLowerCase();
        if (!cleaned) throw new Error('Enter at least one page or range.');
        var result = [];
        cleaned.split(',').forEach(function (part) {
          part = part.trim();
          if (!part) return;
          var match = part.match(/^(\d+|end)(?:\s*-\s*(\d+|end))?$/);
          if (!match) throw new Error('Use a format like 1-3, 5, 8-end.');
          var start = match[1] === 'end' ? total : Number(match[1]);
          var finish = match[2] ? (match[2] === 'end' ? total : Number(match[2])) : start;
          if (start < 1 || finish < 1 || start > total || finish > total) throw new Error('Choose pages between 1 and ' + total + '.');
          if (start > finish) throw new Error('A range must start before it ends.');
          for (var i = start; i <= finish; i++) if (result.indexOf(i - 1) === -1) result.push(i - 1);
        });
        if (!result.length) throw new Error('Enter at least one page or range.');
        return result;
      }

      $('merge-action').addEventListener('click', async function () {
        if (!window.PDFLib || state.merge.length < 2) return;
        var button = this; button.disabled = true;
        try {
          setStatus('merge', 'Combining ' + state.merge.length + ' files…', '', true);
          var out = await window.PDFLib.PDFDocument.create();
          for (var i = 0; i < state.merge.length; i++) {
            setStatus('merge', 'Adding file ' + (i + 1) + ' of ' + state.merge.length + '…', '', true);
            var source = await window.PDFLib.PDFDocument.load(await state.merge[i].arrayBuffer(), { ignoreEncryption: false });
            var indices = source.getPageIndices();
            var copied = await out.copyPages(source, indices);
            copied.forEach(function (page) { out.addPage(page); });
          }
          var bytes = await out.save({ useObjectStreams: true });
          var size = downloadBytes(bytes, 'merged.pdf');
          setStatus('merge', 'Merged PDF downloaded · ' + prettySize(size), 'success', false);
        } catch (error) { setStatus('merge', friendlyError(error), 'error', false); }
        button.disabled = state.merge.length < 2;
      });

      $('split-action').addEventListener('click', async function () {
        if (!window.PDFLib || !state.split[0]) return;
        var button = this; button.disabled = true;
        try {
          setStatus('split', 'Extracting pages…', '', true);
          var source = await window.PDFLib.PDFDocument.load(await state.split[0].arrayBuffer(), { ignoreEncryption: false });
          var indices = parseRanges($('page-range').value, source.getPageCount());
          var out = await window.PDFLib.PDFDocument.create();
          var copied = await out.copyPages(source, indices); copied.forEach(function (page) { out.addPage(page); });
          var bytes = await out.save({ useObjectStreams: true });
          var size = downloadBytes(bytes, safePdfName($('split-name').value, 'extracted-pages.pdf'));
          setStatus('split', indices.length + ' page' + (indices.length === 1 ? '' : 's') + ' downloaded · ' + prettySize(size), 'success', false);
        } catch (error) { setStatus('split', error.message && !/encrypt|invalid|parse|header|xref/i.test(error.message) ? error.message : friendlyError(error), 'error', false); }
        button.disabled = !state.split.length;
      });

      function fileToJpeg(file, quality) {
        return new Promise(function (resolve, reject) {
          var url = URL.createObjectURL(file); var image = new Image();
          image.onload = function () {
            try {
              var canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
              var ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0);
              canvas.toBlob(function (blob) { URL.revokeObjectURL(url); if (!blob) return reject(new Error('Could not read image.')); blob.arrayBuffer().then(resolve, reject); }, 'image/jpeg', quality || .9);
            } catch (error) { URL.revokeObjectURL(url); reject(error); }
          };
          image.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not read image.')); };
          image.src = url;
        });
      }

      $('images-action').addEventListener('click', async function () {
        if (!window.PDFLib || !state.images.length) return;
        var button = this; button.disabled = true;
        try {
          var out = await window.PDFLib.PDFDocument.create();
          var setting = $('page-size').value; var margin = Number($('image-margin').value);
          for (var i = 0; i < state.images.length; i++) {
            setStatus('images', 'Building page ' + (i + 1) + ' of ' + state.images.length + '…', '', true);
            var jpegBytes = await fileToJpeg(state.images[i], .92);
            var image = await out.embedJpg(jpegBytes); var dims = image.scale(1); var pageW, pageH;
            if (setting === 'a4') { pageW = 595.28; pageH = 841.89; }
            else if (setting === 'letter') { pageW = 612; pageH = 792; }
            else { pageW = Math.max(72, dims.width + margin * 2); pageH = Math.max(72, dims.height + margin * 2); }
            if (setting !== 'fit' && ((dims.width > dims.height) !== (pageW > pageH))) { var swap = pageW; pageW = pageH; pageH = swap; }
            var page = out.addPage([pageW, pageH]); var maxW = pageW - margin * 2; var maxH = pageH - margin * 2;
            var scale = Math.min(maxW / dims.width, maxH / dims.height); var drawW = dims.width * scale; var drawH = dims.height * scale;
            page.drawImage(image, { x: (pageW - drawW) / 2, y: (pageH - drawH) / 2, width: drawW, height: drawH });
          }
          var bytes = await out.save({ useObjectStreams: true }); var size = downloadBytes(bytes, 'images.pdf');
          setStatus('images', state.images.length + ' page PDF downloaded · ' + prettySize(size), 'success', false);
        } catch (error) { setStatus('images', 'One of these images could not be processed.', 'error', false); }
        button.disabled = !state.images.length;
      });

      $('rotate-action').addEventListener('click', async function () {
        if (!window.PDFLib || !state.rotate[0]) return;
        var button = this; button.disabled = true;
        try {
          setStatus('rotate', 'Applying page rotation…', '', true);
          var doc = await window.PDFLib.PDFDocument.load(await state.rotate[0].arrayBuffer(), { ignoreEncryption: false });
          var total = doc.getPageCount();
          var selection = $('rotate-pages').value.trim().toLowerCase();
          var indices = selection === 'all' ? doc.getPageIndices() : parseRanges(selection, total);
          var turn = Number($('rotate-angle').value);
          indices.forEach(function (index) {
            var page = doc.getPage(index);
            var current = page.getRotation().angle || 0;
            page.setRotation(window.PDFLib.degrees((current + turn) % 360));
          });
          var bytes = await doc.save({ useObjectStreams: true });
          var name = 'rotated-' + safePdfName(state.rotate[0].name, 'document.pdf');
          var size = downloadBytes(bytes, name);
          setStatus('rotate', indices.length + ' page' + (indices.length === 1 ? '' : 's') + ' rotated · ' + prettySize(size), 'success', false);
        } catch (error) {
          setStatus('rotate', error.message && !/encrypt|invalid|parse|header|xref/i.test(error.message) ? error.message : friendlyError(error), 'error', false);
        }
        button.disabled = !state.rotate.length;
      });

      function clearGeneratedImages() {
        generatedImageUrls.forEach(function (url) { URL.revokeObjectURL(url); });
        generatedImageUrls = [];
        $('pdfimages-downloads').innerHTML = '';
      }
      function canvasToBlob(canvas, type, quality) {
        return new Promise(function (resolve, reject) {
          canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error('Could not create image.')); }, type, quality);
        });
      }
      function addImageDownload(blob, name) {
        var url = URL.createObjectURL(blob); generatedImageUrls.push(url);
        var row = document.createElement('div'); row.className = 'download-row';
        var label = document.createElement('span'); label.textContent = name;
        var link = document.createElement('a'); link.className = 'download-btn'; link.href = url; link.download = name; link.textContent = 'Download'; link.setAttribute('aria-label', 'Download ' + name);
        row.appendChild(label); row.appendChild(link); $('pdfimages-downloads').appendChild(row);
      }

      $('pdfimages-action').addEventListener('click', async function () {
        if (!window.pdfjsLib || !state.pdfimages[0]) return;
        var button = this; button.disabled = true; clearGeneratedImages();
        var pdf;
        try {
          var format = $('export-format').value;
          var extension = format === 'png' ? 'png' : 'jpg';
          var mime = format === 'png' ? 'image/png' : 'image/jpeg';
          var mode = $('export-mode').value;
          if (mode === 'zip' && !window.JSZip) throw new Error('ZIP support could not load. Check your connection and reload.');
          var zip = mode === 'zip' ? new window.JSZip() : null;
          var data = new Uint8Array(await state.pdfimages[0].arrayBuffer());
          pdf = await window.pdfjsLib.getDocument({ data: data }).promise;
          var baseName = state.pdfimages[0].name.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]/g, '-') || 'document';
          for (var pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            setStatus('pdfimages', 'Rendering page ' + pageNumber + ' of ' + pdf.numPages + '…', '', true);
            var pdfPage = await pdf.getPage(pageNumber);
            var view = pdfPage.getViewport({ scale: 2 });
            var canvas = document.createElement('canvas'); canvas.width = Math.ceil(view.width); canvas.height = Math.ceil(view.height);
            var ctx = canvas.getContext('2d', { alpha: false }); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            await pdfPage.render({ canvasContext: ctx, viewport: view }).promise;
            var blob = await canvasToBlob(canvas, mime, format === 'png' ? undefined : .9);
            var pageName = baseName + '-page-' + String(pageNumber).padStart(2, '0') + '.' + extension;
            if (zip) zip.file(pageName, blob); else addImageDownload(blob, pageName);
            canvas.width = 1; canvas.height = 1; pdfPage.cleanup();
          }
          if (zip) {
            setStatus('pdfimages', 'Building ZIP file…', '', true);
            var zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            downloadBlob(zipBlob, baseName + '-images.zip');
            setStatus('pdfimages', pdf.numPages + ' images downloaded in one ZIP · ' + prettySize(zipBlob.size), 'success', false);
          } else {
            setStatus('pdfimages', pdf.numPages + ' images ready — download any page below.', 'success', false);
          }
        } catch (error) {
          setStatus('pdfimages', /ZIP support/.test(error.message || '') ? error.message : friendlyError(error), 'error', false);
        }
        if (pdf) await pdf.destroy();
        button.disabled = !state.pdfimages.length;
      });

      $('compress-action').addEventListener('click', async function () {
        if (!window.PDFLib || !window.pdfjsLib || !state.compress[0]) return;
        var button = this; button.disabled = true;
        try {
          var originalSize = state.compress[0].size;
          var data = new Uint8Array(await state.compress[0].arrayBuffer());
          var loading = window.pdfjsLib.getDocument({ data: data });
          var pdf = await loading.promise; var out = await window.PDFLib.PDFDocument.create();
          var mode = document.querySelector('input[name="quality"]:checked').value;
          var preset = mode === 'small' ? { scale: .85, quality: .48 } : mode === 'clear' ? { scale: 1.45, quality: .82 } : { scale: 1.1, quality: .65 };
          for (var pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            setStatus('compress', 'Compressing page ' + pageNumber + ' of ' + pdf.numPages + '…', '', true);
            var pdfPage = await pdf.getPage(pageNumber); var base = pdfPage.getViewport({ scale: 1 }); var view = pdfPage.getViewport({ scale: preset.scale });
            var canvas = document.createElement('canvas'); canvas.width = Math.ceil(view.width); canvas.height = Math.ceil(view.height);
            var ctx = canvas.getContext('2d', { alpha: false }); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            await pdfPage.render({ canvasContext: ctx, viewport: view }).promise;
            var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', preset.quality); });
            if (!blob) throw new Error('Page rendering failed.');
            var image = await out.embedJpg(await blob.arrayBuffer());
            var page = out.addPage([base.width, base.height]); page.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
            canvas.width = 1; canvas.height = 1; pdfPage.cleanup();
          }
          var bytes = await out.save({ useObjectStreams: true }); var outputSize = downloadBytes(bytes, 'compressed-' + safePdfName(state.compress[0].name, 'document.pdf'));
          var difference = Math.round((1 - outputSize / originalSize) * 100);
          var message = difference > 0 ? 'Downloaded · ' + difference + '% smaller (' + prettySize(outputSize) + ')' : 'Downloaded · ' + prettySize(outputSize) + ' (this PDF could not be made smaller)';
          setStatus('compress', message, 'success', false); await pdf.destroy();
        } catch (error) { setStatus('compress', friendlyError(error), 'error', false); }
        button.disabled = !state.compress.length;
      });
    })();
