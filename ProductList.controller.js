sap.ui.define([
    'sap/ui/core/mvc/ControllerExtension',
    'sap/fe/templates/ListReport/ExtensionAPI',
    'sap/m/MessageToast',
    'sap/m/Dialog',
    'sap/ui/unified/FileUploader',
    'sap/ui/model/resource/ResourceModel',
    'sap/base/i18n/ResourceBundle',
    'sap/ui/core/Messaging',
    'sap/ui/core/message/Message',
    'sap/ui/core/message/MessageType',
    'sap/ui/model/odata/v4/ODataContextBinding',
    'sap/ui/core/Fragment',
    'sap/ui/core/util/File'
], function (
    ControllerExtension,
    ExtensionAPI,
    MessageToast,
    Dialog,
    FileUploader,
    ResourceModel,
    ResourceBundle,
    Messaging,
    Message,
    MessageType,
    ODataContextBinding,
    Fragment,
    FileUtil
) {
    return ControllerExtension.extend("miyasuta.rapexcelupload.ext.controller.ProductList", {
        dialog: null,
        fileType: null,
        fileName: null,
        fileContent: undefined,
        namespace: "com.sap.gateway.srvd.zui_yproduct_o4.v0001.",

        onInit: function () {
            const model = this.base.getExtensionAPI().getModel();
        },

        uploadProduct: function () {
            this.base.getExtensionAPI().loadFragment({
                id: "uploadFileDialog",
                name: "miyasuta.rapexcelupload.ext.fragment.uploadFileDialog",
                controller: this
            }).then(fragment => {
                this.dialog = fragment;
                this.dialog.open();
            });
        },

        onFileChange: function (event) {
            const files = event.getParameter("files");
            if (!files) {
                return;
            }
            const file = files[0];
            this.fileType = file.type;
            this.fileName = file.name;

            const fileReader = new FileReader();
            const that = this;

            const readFile = function (file) {
                return new Promise(resolve => {
                    fileReader.onload = function (loadEvent) {
                        const result = loadEvent.target?.result;
                        const match = result.match(/,(.*)$/);
                        if (match && match[1]) {
                            that.fileContent = match[1];
                            resolve();
                        }
                    };
                    fileReader.readAsDataURL(file);
                });
            };

            this.base.getExtensionAPI().getEditFlow().securedExecution(() => readFile(file), {
                busy: { set: true }
            });
        },

        onUploadPress: function () {
            const resourceBundle = this.base.getExtensionAPI().getModel("i18n").getResourceBundle();
            if (!this.fileContent) {
                const fileErrorMessage = resourceBundle.getText("uploadFileErrMeg") || "";
                MessageToast.show(fileErrorMessage);
                return;
            }

            const model = this.base.getExtensionAPI().getModel();
            const operation = model.bindContext("/Product/" + this.namespace + "fileUpload(...)");

            const funSuccess = () => {
                model.refresh();
                const uploadSuccessMessage = resourceBundle.getText("uploadFileSuccMsg") || "";
                MessageToast.show(uploadSuccessMessage);
                this.dialog.close();
                Fragment.byId("uploadFileDialog", "idFileUpload").clear();
                this.dialog.destroy();
                this.fileContent = undefined;
            };

            const fnError = (oError) => {
                this.base.getExtensionAPI().getEditFlow().securedExecution(() => {
                    Messaging.addMessages(new Message({
                        message: oError.message,
                        target: "",
                        persistent: true,
                        type: MessageType.Error,
                        code: oError.error.code
                    }));
                    oError.error.details.forEach(error => {
                        Messaging.addMessages(new Message({
                            message: error.message,
                            target: "",
                            persistent: true,
                            type: MessageType.Error,
                            code: error.error.code
                        }));
                    });
                    this.dialog.close();
                    Fragment.byId("uploadFileDialog", "idFileUpload").clear();
                    this.dialog.destroy();
                    this.fileContent = undefined;
                });
            };

            operation.setParameter("mimeType", this.fileType);
            operation.setParameter("fileName", this.fileName);
            operation.setParameter("fileContent", this.fileContent);
            operation.setParameter("fileExtension", this.fileName.split(".")[1]);
            operation.invoke().then(funSuccess, fnError);
        },

        onCancelPress: function () {
            this.dialog.close();
            this.dialog.destroy();
            this.fileContent = undefined;
        },

        onTempDownload: function () {
            const model = this.base.getExtensionAPI().getModel();
            const resourceBundle = this.base.getExtensionAPI().getModel("i18n").getResourceBundle();
            const operation = model.bindContext("/Product/" + this.namespace + "downloadFile(...)");

            const fnSuccess = () => {
                const result = operation.getBoundContext().getObject();
                const fixedFileContent = this.convertBase64(result.fileContent);
                const uint8Array = Uint8Array.from(atob(fixedFileContent), c => c.charCodeAt(0));
                const blob = new Blob([uint8Array], { type: result.mimeType });
                FileUtil.save(blob, result.fileName, result.fileExtension, result.mimeType, 'utf-8');
                const downloadSuccessMessage = resourceBundle.getText("downloadTempSuccMsg") || "";
                MessageToast.show(downloadSuccessMessage);
            };

            const fnError = (oError) => {
                this.base.getExtensionAPI().getEditFlow().securedExecution(() => {
                    Messaging.addMessages(new Message({
                        message: oError.message,
                        target: "",
                        persistent: true,
                        type: MessageType.Error,
                        code: oError.error.code
                    }));
                    oError.error.details.forEach(error => {
                        Messaging.addMessages(new Message({
                            message: error.message,
                            target: "",
                            persistent: true,
                            type: MessageType.Error,
                            code: error.error.code
                        }));
                    });
                });
            };

            operation.invoke().then(fnSuccess, fnError);
        },

        convertBase64: function (urlSafeBase64) {
            return urlSafeBase64.replace(/_/g, '/').replace(/-/g, '+');
        }
    });
});
