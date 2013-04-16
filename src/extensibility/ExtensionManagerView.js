/*
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, window, $, brackets, Mustache */
/*unittests: ExtensionManager*/

define(function (require, exports, module) {
    "use strict";
    
    var Strings                = require("strings"),
        NativeApp              = require("utils/NativeApp"),
        InstallExtensionDialog = require("extensibility/InstallExtensionDialog"),
        ExtensionLoader        = require("utils/ExtensionLoader"),
        registry_utils         = require("extensibility/registry_utils"),
        registryTemplate       = require("text!htmlContent/extension-manager-view.html");
    
    /**
     * @constructor
     * Creates a view listing the contents of the given registry.
     * @param {ExtensionManagerModel} model The model for this view.
     */
    function ExtensionManagerView(model) {
        var self = this;
        this._model = model;
        this._template = Mustache.compile(registryTemplate);
        this.$el = $("<div class='extension-list'/>");
        
        $(this.$el)
            // Intercept clicks on external links to open in the native browser.
            .on("click", "a", function (e) {
                e.stopImmediatePropagation();
                e.preventDefault();
                NativeApp.openURLInDefaultBrowser($(e.target).attr("href"));
            })
            // Handle install button clicks
            .on("click", "button.install", function (e) {
                self._installUsingDialog($(this).attr("data-extension-id"));
            });
        
        var $spinner = $("<div class='spinner large spin'/>")
            .appendTo(this.$el);
        model.getRegistry().done(function (registry) {
            self._render(registry_utils.sortRegistry(registry));
        }).fail(function () {
            $("<div class='alert-message error'/>")
                .text(Strings.EXTENSION_MANAGER_ERROR_LOAD)
                .appendTo(self.$el);
        }).always(function () {
            $spinner.remove();
        });
    }
    
    /**
     * @private
     * @type {ExtensionManagerModel}
     * The model containing the registry data.
     */
    ExtensionManagerView.prototype._model = null;
    
    /**
     * @private
     * @type {function} The compiled template we use for rendering the registry list.
     */
    ExtensionManagerView.prototype._template = null;
    
    /**
     * @type {jQueryObject}
     * The root of the view's DOM tree.
     */
    ExtensionManagerView.prototype.$el = null;
    
    /**
     * @private
     * Display the given registry data.
     * @param {object} registry The registry data to show.
     */
    ExtensionManagerView.prototype._render = function (registry) {
        // Create a Mustache context object containing the registry and our helper functions.
        var context = { registry: registry },
            loadedMetadata = ExtensionLoader.getLoadedExtensionMetadata();
        ["lastVersionDate", "ownerLink", "formatUserId"].forEach(function (helper) {
            context[helper] = registry_utils[helper];
        });
        
        // TODO: should this be mediated through the model instead of going to the ExtensionLoader
        // directly?
        context.isInstalled = function () {
            return function (text, render) {
                if (loadedMetadata[this.metadata.name]) {
                    return render(text);
                } else {
                    return "";
                }
            };
        };
        
        // TODO: localize strings in template
        // TODO: template should show "Installed" for already-installed items, but
        // Mustache doesn't let you negate a section helper.
        this.$el.html(this._template(context));
    };
    
    /**
     * @private
     * Install the extension with the given ID using the install dialog.
     * @param {string} id ID of the extension to install.
     */
    ExtensionManagerView.prototype._installUsingDialog = function (id) {
        var self = this;
        this._model.getRegistry().done(function (registry) {
            var entry = registry[id];
            if (entry) {
                var url = "https://s3.amazonaws.com/repository.brackets.io/" + id + "/" + id + "-" + entry.metadata.version + ".zip";
                InstallExtensionDialog.showDialog(url)
                    .done(function () {
                        // When the install is completed, disable the "Install" button.
                        // TODO: This is sort of bogus. We shouldn't wait for the user to dismiss the dialog
                        // before showing the extension as installed...we should probably have real events from
                        // the extension loader or model.
                        // TODO: Would be nice to be able to reuse the template to get the button re-rendered right,
                        // but re-rendering the whole template is overkill. Backbone would have been handy here.
                        $("button.install[data-extension-id=" + id + "]", self.$el)
                            .attr("disabled", "disabled");
                    });
            }
        });
    };
    
    exports.ExtensionManagerView = ExtensionManagerView;
});