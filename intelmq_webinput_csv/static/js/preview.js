/*
 * Copyright (c) 2017-2018 nic.at GmbH <wagner@cert.at>
 * SPDX-License-Identifier: AGPL-3.0
 */

Vue.component('v-select', VueSelect.VueSelect)
var vm_preview = new Vue({
    el: '#CSVapp',

    data: {
        socket: io('/preview', {path: BASE_URL + '/socket.io/preview'}),
        numberTotal: 0,
        numberSuccessful: 0,
        numberFailed: 0,
        message: "",
        numberSuccessful: 0,
        servedUseColumns: [],
        servedColumnTypes: [],
        classificationTypes: [],
        classificationMapping: {},
        servedDhoFields: [],
        customDhoFields: [],
        customUseColumns: [],
        finishedRequests: [],
        previewFormData: {
            timezone: '+00:00',
            classificationType: 'test',
            dryRun: true,
            useColumn: 0,
            columns: 'source.ip',
            pipeline: '',
            uuid: d_uuid
        },
        hasHeader: (sessionStorage.hasHeader === 'true'),
        headerContent: [],
        bodyContent: [],
        usedButton: null, 
        pipelines: d_pipelines
    },
    computed: {
        timezones: function () {
            var timezones_list = [];

            // write hours to array
            for (var i = -12; i <= 12; i++) {
                var timeZoneString = '';
                if (i < 0) {
                    if ((i / -10) < 1) {
                        timeZoneString = '-0' + (-i);
                        timezones_list.push(timeZoneString);
                    } else {
                        timezones_list.push(i.toString());
                    }
                } else {
                    if ((i / 10) < 1) {
                        timeZoneString = '+0' + i;
                        timezones_list.push(timeZoneString);
                    } else {
                        timezones_list.push('+' + i.toString());
                    }
                }
            }

            // concat minutes to existing hours
            for (var i = 0; i < timezones_list.length; i++) {
                timezones_list[i] = timezones_list[i] + ':00';
            }

            return timezones_list;
        },
    },
    methods: {
        loadFile: function (url, callback) {
            $.getJSON(url)
                .done(function (json) {
                    callback(json);
                })
                .fail(function (jqxhr, textStatus, error) {
                    var err = textStatus + ", " + error;
                    callback({});
                });
        },
        loadClassificationTypes: function (classificationTypes) {
            this.classificationMapping = classificationTypes
            this.classificationTypes = Object.keys(classificationTypes);
            this.completeRequest('types');
        },
        loadServedDhoFields: function (servedDhoFields) {
            this.servedDhoFields = servedDhoFields;
            this.completeRequest('fields');
        },
        getClassificationTypes: function () {
            this.dispatchRequest(BASE_URL + '/classification/types', this.loadClassificationTypes, 'types');
        },
        getServedDhoFields: function () {
            this.dispatchRequest(BASE_URL + '/harmonization/event/fields', this.loadServedDhoFields, 'fields');
        },
        dispatchRequest: function (url, callback, key) {
            this.loadFile(url, callback);
            this.finishedRequests[key] = false;
        },
        completeRequest: function (url) {
            this.finishedRequests[url] = true;
            this.checkAllRequestsFinished();
        },
        checkAllRequestsFinished: function () {
            var allFinished = true;
            for (key in this.finishedRequests) {
                if (!this.finishedRequests[key]) {
                    allFinished = false;
                    break;
                }
            }

            if (allFinished) {
                this.setPredefinedData();
            }
        },
        submitButtonClicked: function (e) {
            this.cleanUp();

            $('body,html').animate({
                scrollTop: 0
            }, 800);

            // Verify pipeline selection
            if (Object.keys(this.pipelines).length && !this.previewFormData.pipeline) {
                this.message = "Failed to select pipeline";
                $('select#pipeline').parent().addClass("is-danger");
                return;
            }

            this.usedButton = $(e.target);
            var progressBar = $("#progress");

            progressBar.removeAttr('value');
            this.usedButton.addClass("is-loading");

            this.getColumns();
            this.getUseColumn();

            var formData = new FormData();

            formData.append('timezone', this.previewFormData.timezone);
            formData.append('uuid', this.previewFormData.uuid);
            formData.append('classification.type', this.previewFormData.classificationType);
            formData.append('dryrun', this.previewFormData.dryRun);
            formData.append('use_column', this.previewFormData.useColumn);
            formData.append('columns', this.previewFormData.columns);
            formData.append('pipeline', this.previewFormData.pipeline);

            // custom_fields defined in HTML
            for (field_name in custom_fields) {
                jskey = custom_fields[field_name];
                formData.append('custom_'+field_name, this.previewFormData[jskey]);
                this.previewFormData[jskey] = field_name;
            }

            // obligatory data -> from upload form
            formData.append('delimiter', sessionStorage.delimiter);
            formData.append('quotechar', sessionStorage.quotechar);
            formData.append('use_header', sessionStorage.useHeader);
            formData.append('has_header', sessionStorage.hasHeader);

            // optional data -> from upload form
            formData.append('skipInitialSpace', sessionStorage.skipInitialSpace);
            formData.append('skipInitialLines', sessionStorage.skipInitialLines);
            formData.append('loadLinesMax', sessionStorage.loadLinesMax);

            this.saveDataInSession();
            this.socket.emit("submit", Object.fromEntries(formData.entries()));
        },
        failedButtonClicked: function (e) {
            var button = $(e.target);
            window.open(BASE_URL + '/uploads/failed', '_blank');
        },
        refreshButtonClicked: function (e) {
            this.cleanUp();

            this.usedButton = $(e.target);
            var progressBar = $("#progress");

            this.usedButton.addClass("is-loading");
            progressBar.removeAttr('value');

            $('body,html').animate({
                scrollTop: 0
            }, 800);

            this.getColumns();
            this.getUseColumn();

            var formData = new FormData();

            formData.append('pipeline', []);
            formData.append('timezone', this.previewFormData.timezone);
            formData.append('classification.type', this.previewFormData.classificationType);
            formData.append('dryrun', this.previewFormData.dryRun);
            formData.append('use_column', this.previewFormData.useColumn);
            formData.append('columns', this.previewFormData.columns);

            // custom_fields defined in HTML
            for (field_name in custom_fields) {
                jskey = custom_fields[field_name];
                formData.append('custom_'+field_name, this.previewFormData[jskey]);
                this.previewFormData[jskey] = field_name;
            }

            // obligatory data -> from upload form
            formData.append('delimiter', sessionStorage.delimiter);
            formData.append('quotechar', sessionStorage.quotechar);
            formData.append('use_header', sessionStorage.useHeader);
            formData.append('has_header', sessionStorage.hasHeader);

            // optional data -> from upload form
            formData.append('skipInitialSpace', sessionStorage.skipInitialSpace);
            formData.append('skipInitialLines', sessionStorage.skipInitialLines);
            formData.append('loadLinesMax', sessionStorage.loadLinesMax);

            this.saveDataInSession();
            this.socket.emit("validate", Object.fromEntries(formData.entries()));
        },
        saveDataInSession: function () {
            this.getColumns();
            this.getUseColumn();
            for (key in this.previewFormData) {
                sessionStorage.setItem(key, this.previewFormData[key]);
            }
        },
        loadDataFromSession: function () {
            for (key in this.previewFormData) {
                if (sessionStorage.getItem(key) === null || key === 'uuid') {
                    continue;
                } else {
                    try {
                        this.previewFormData[key] = JSON.parse(sessionStorage.getItem(key));
                    } catch (e) {
                        this.previewFormData[key] = sessionStorage.getItem(key);
                    }
                }
            }
        },
        getColumns: function () {
            this.previewFormData.columns = [];
            var dataTable = $('#dataTable')[0];
            var numberOfColumns = dataTable.rows[0].cells.length;

            for (var i = 0; i < numberOfColumns; i++) {
                var cell = dataTable.rows[0].cells[i];
                selectedValue = cell.firstChild.firstChild.firstChild.firstChild.firstChild;
                if (null === selectedValue) {
                    value = null;
                } else {
                    value = selectedValue.data.trim()
                }
                this.previewFormData.columns.push(value);
            }
        },
        getUseColumn: function () {
            this.previewFormData.useColumn = [];
            var dataTable = $('#dataTable')[0];
            var numberOfColumns = dataTable.rows[0].cells.length;

            for (var i = 0; i < numberOfColumns; i++) {
                var cell = dataTable.rows[1].cells[i];
                this.previewFormData.useColumn.push($('input', cell)[0].checked);
            }

            if (this.previewFormData.useColumn.length > 0) {
                this.customUseColumns = this.previewFormData.useColumn;
            }
        },
        cleanUp: function () {
            var progressBar = $("#progress");
            this.message = "";

            // Disable Failed downoad button
            $('button#failedButton').attr('disabled')
            $('select#pipeline').parent().removeClass("is-danger");

            // Cleanup progressbar
            progressBar.val(0);
            progressBar.removeClass("is-success is-danger is-warning")
            progressBar.addClass("is-info")

            // Remove any previous failed/successful indicators
            this.numberFailed = this.numberSuccessful = 0;

            // Ensure that no faulty cells are shown
            $('td[style]').each( function() {
                $(this).removeAttr('style');
            });
        },
        highlightErrors: function (data) {
            return new Promise(resolve => {
                var rows = $('#dataTable > tbody')[0].rows.length;

                for (var i = 0; i < data.errors.length; i++) {
                    if (data.errors[i][0] >= rows) {
                        continue;  // Row is not shown in preview
                    }
                    $('#dataTable > tbody')[0].rows[data.errors[i][0]].cells[data.errors[i][1]].setAttribute('style', 'background-color: #ffcccc')
                }
                
                resolve();
            });
        },
        splitUploadResponse: function () {
            var uploadResponse = sessionStorage.getItem('uploadResponse');
            if (uploadResponse == "") return;

            uploadResponse = JSON.parse(uploadResponse);

            if (this.hasHeader) {
                this.headerContent = uploadResponse.preview.splice(0, 1);
                this.bodyContent = uploadResponse.preview;
            } else {
                this.headerContent = [];
                this.bodyContent = uploadResponse.preview;
            }

            this.servedColumnTypes = uploadResponse.column_types;
            this.servedUseColumns = uploadResponse.use_column;
        },
        fillCustomDhoFields: function () {
            for (index in this.servedColumnTypes) {
                if (this.servedColumnTypes[index] === null) {
                    this.customDhoFields.push(Object.keys(this.servedDhoFields));
                } else {
                    this.customDhoFields.push(Object.keys(this.getDhoListOfType(this.servedColumnTypes[index])));
                }
            }
        },
        fillCustomUseColumns: function () {
            this.customUseColumns = this.servedUseColumns;
        },
        setPredefinedData: function () {
            this.fillCustomDhoFields();
            this.fillCustomUseColumns();
        },
        getDhoListOfType: function (type) {
            var dhoList = {};
            for (key in this.servedDhoFields) {
                if (this.servedDhoFields[key].type === type) {
                    dhoList[key] = this.servedDhoFields[key];
                }
            }
            return dhoList;
        },
        classificationTypeChange: function (event) {
            $("#resulting-taxonomy")[0].innerText = this.classificationMapping[event.target.value]
        },
        processingEvent: function (data) {
            var progressBar = $("#progress");
            this.message = data['message'];

            if (data['progress'])
                progressBar.val(data['progress']);

            if (data['failed'] > 0 && data['successful'] == 0) {
                progressBar.removeClass("is-info is-warning")
                progressBar.addClass("is-danger")
            } else if (data['failed'] > 0 && data['successful'] > 0) {
                progressBar.removeClass("is-info is-danger")
                progressBar.addClass("is-warning")
            }

            this.numberTotal = data['total'];
            this.numberSuccessful = data['successful'];
            this.numberFailed = data['failed'];
        },
        finishedEvent: async function (data) {
            var progressBar = $("#progress");

            this.numberTotal = data['total'];
            this.numberFailed = data['failed'];
            this.numberSuccessful = data['successful'];

            this.usedButton.removeClass("is-loading");

            progressBar.val(100);
            this.message = data['message'];

            if (this.numberFailed > 0){
                $('button#failedButton').removeAttr('disabled')
                await this.highlightErrors(data);
            } else if (this.numberFailed == 0) {
                progressBar.removeClass("is-info")
                progressBar.addClass("is-success")
            }
        }
    },
    beforeMount() {
        // custom_fields defined in HTML
        for (field_name in custom_fields) {
            jskey = custom_fields[field_name];
            this.previewFormData[jskey] = field_name;
        }

        this.socket.on('data', this.processingEvent);
        this.socket.on('processing', this.processingEvent);
        this.socket.on('finished', this.finishedEvent);

        this.getServedDhoFields();
        this.getClassificationTypes();
        this.loadDataFromSession();
        this.splitUploadResponse();
    },
});
