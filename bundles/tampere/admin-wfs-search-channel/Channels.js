/**
 * @class Oskari.tampere.bundle.tampere.admin-wfs-search-channel.Channels
 *
 * Renders the "admin channels" flyout.
 *
 */
Oskari.clazz.define(
    'Oskari.tampere.bundle.tampere.admin-wfs-search-channel.Channels',
    function (localization, parent) {
        this.instance = parent;
        this.sandbox = parent.getSandbox();
        this._localization = localization;
        this.templates = {};

        this.setTitle(localization.title);
        this.setContent(this.createUi());
        this.state = {};
    },{

        /**
         * @private @method _initTemplates
         *
         *
         */
        _initTemplates: function () {
            var me = this,
                btn,
                i;

            me.templates.main = jQuery('<div class="admin-channels"></div>');
            me.templates.search = jQuery(
                '<div>' +
                '  <input type="search"></input>' +
                '  <div class="icon-close"></div>' +
                '</div>'
            );
            me.templates.search.find('input').keypress(
                function (event) {
                    if (event.keyCode === 10 || event.keyCode === 13) {
                        me._filterList(event, me);
                    }
                }
            );
            me.templates.search.find('div.icon-close').click(
                function (event) {
                    jQuery(event.target)
                        .parent()
                        .find('input[type=search]')
                        .val('');
                    me._filterList(event, me);
                }
            );
            btn = Oskari.clazz.create(
                'Oskari.userinterface.component.buttons.SearchButton'
            );
            // jQuery doesn't clone handlers that aren't created with jQuery,
            // so we have to do this with jQuery...
            jQuery(btn.getElement()).click(
                function (event) {
                    me._filterList(event, me);
                }
            );
            btn.insertTo(me.templates.search);

            me.templates.form = jQuery(
                '<form method="" action="">' +
                '<fieldset>' +
                '    <input type="hidden" name="id" />' +
                '    <label>' +
                '        <span></span>' +
                '        <select name="choose-wfs-layer" required="required"></select>' +
                '    </label>' +
                '       <h4></h4>' +
                '           <div class="details--wrapper"></div>' +
                '    <label>' +
                '        <span></span>' +
                '        <select name="choose-param-for-search" required="required"></select>' +
                '        <div class="remove--param icon-close hidden"></div>' +
                '    </label>' +
                '</fieldset>' +
                '<fieldset></fieldset>' +
                '</form>'
            );

            jQuery.each(Oskari.getSupportedLanguages(), function(index, item) {
                me.templates.form.detailinputs = jQuery(
                '    <label>' +
                '        <span></span>' +
                '        <input type="text" name="details-topic-'+item+'" language="details-name-'+item+'" required="required" />' +
                '    </label>' +
                '    <label>' +
                '        <input type="text" name="details-desc-'+item+'" class="no-span-text" language="details-desc-'+item+'" required="required" />' +
                '    </label>'
                );
                me.templates.form.find('.details--wrapper').append(me.templates.form.detailinputs);
            });

            me.templates.form.find(".remove--param").click(function(event){
                jQuery(this).parent().remove();
                event.preventDefault;
            });

             me.templates.form.find("select[name=choose-wfs-layer]").change(function(event) {
                 me.getWFSLayerColumns(jQuery(this).val(), jQuery(this).parents('fieldset'));
                 event.preventDefault;
             });

            //me.templates.form.attr('action', me.sandbox.getAjaxUrl() + me.instance.conf.restUrl);
            me.templates.form.find('input,select').each(function (index) {
                var el = jQuery(this);
                el.prev('span').html(me._getLocalization(el.attr('name')));
                if(el.attr("language") != null){
                   el.attr("placeholder", me._getLocalization(el.attr("language")));
                }
            });

            me.templates.form.find('h4').text(me._getLocalization('channel-details-header'));

            var firstFieldset = me.templates.form.find(
                'fieldset:nth-of-type(1)'
            );
            btn = Oskari.clazz.create(
                'Oskari.userinterface.component.Button'
            );
            btn.setTitle(me._getLocalization("new-params-btn"));
            btn.addClass('btn--center');
            jQuery(btn.getElement()).click(
                function (event) {
                    var newParams = jQuery(this).prev("label").clone(true);
                    newParams.find(".remove--param").removeClass("hidden");
                    jQuery(this).before(newParams);
                }
            );
            btn.insertTo(firstFieldset);

            var buttonFieldset = me.templates.form.find(
                'fieldset:nth-of-type(2)'
            );
            btn = Oskari.clazz.create(
                'Oskari.userinterface.component.buttons.SaveButton'
            );
            btn.insertTo(buttonFieldset);
            btn = Oskari.clazz.create(
                'Oskari.userinterface.component.buttons.DeleteButton'
            );
            btn.addClass('delete--channel hidden');
            jQuery(btn.getElement()).click(
                function (event) {
                    me._deleteChannel(event, me);
                }
            );
            btn.insertTo(buttonFieldset);
            btn = Oskari.clazz.create(
                'Oskari.userinterface.component.buttons.CancelButton'
            );
            jQuery(btn.getElement()).click(
                function (event) {
                    me._closeForm(jQuery(event.target).parents('form'));
                }
            );
            btn.insertTo(buttonFieldset);

            me.template.roleOption = jQuery(
                '<option></option>'
            );

            me.templates.list = jQuery('<ul></ul>');

            me.templates.item = jQuery(
                '<li class="accordion">' +
                '<div class="header accordion-header clearfix">' +
                '   <h3></h3>' +
                '</div>' +
                '</li>'
            );
            btn = Oskari.clazz.create('Oskari.userinterface.component.buttons.EditButton');
            btn.setName('edit');
            jQuery(btn.getElement()).click(
                function (event) {
                    me._openForm(event, me);
                }
            );
            btn.insertTo(me.templates.item.find('div.header'));
            me.templates.main.append(me.templates.search);
            me.createWfsLayerSelect();
        },
        /**
         * @method [createWfsLayerSelect], reads wfs layers from Oskari and loops them into select
         * @return {[type]}
         */
        createWfsLayerSelect: function (){
            var me = this;
            var epsg = this.sandbox.getMap().getSrsName(),
                    ajaxUrl = this.sandbox.getAjaxUrl(),
                    timeStamp = new Date().getTime();

            jQuery.ajax({
                type: "GET",
                dataType: 'json',
                data : {
                    timestamp : timeStamp,
                    epsg : epsg
                },
                beforeSend: function (x) {
                    if (x && x.overrideMimeType) {
                        x.overrideMimeType("application/json;charset=UTF-8");
                    }
                },
                url: ajaxUrl + 'action_route=GetMapLayers&lang=' + Oskari.getLang(),
                success: function (data) {
                    var allLayers = data.layers;
                    var wfsLayers = jQuery.grep(allLayers, function(layer,index){
                        return layer.type.toLowerCase() === 'wfslayer';
                    });

                    jQuery.each(wfsLayers, function(index, layer){
                        me.templates.form.find('select[name=choose-wfs-layer]').append(jQuery('<option>', { 
                            value: layer.id,
                            text : layer.name[Oskari.getLang()]
                        }));
                    });
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    var error = me._getErrorText(jqXHR, textStatus, errorThrown);

                    me._openPopup(
                        me._getLocalization('layers_failed'),
                        error
                    );
                }
            });
        },

        /**
         * [getWFSLayerColumns description]
         * @param  {[type]}
         * @return {[type]}
         */
        getWFSLayerColumns: function (layer_id, el) {
            var me = this;

            var url = this.sandbox.getAjaxUrl() + 'action_route=GetWFSDescribeFeature&layer_id=' + layer_id;
            jQuery.ajax({
                type: 'GET',
                dataType: 'json',
                url: url,
                beforeSend: function (x) {
                    if (x && x.overrideMimeType) {
                        x.overrideMimeType('application/j-son;charset=UTF-8');
                    }
                },
                success: function (data) {
                    jQuery(el).find('select[name=choose-param-for-search]').empty();
                    jQuery.each(data.propertyTypes, function(name, type){
                        jQuery(el).find('select[name=choose-param-for-search]').append(jQuery('<option>', { 
                            value: type,
                            text : name
                        }));
                    });
                },
                error: function (jqXHR, textStatus, errorThrown) {
                    var error = me._getErrorText(jqXHR, textStatus, errorThrown);

                    me._openPopup(
                        me._getLocalization('layers_failed'),
                        error
                    );
                }
            });
        },

        /**
         * [fetchChannels fetchChannels]
         * @param  {[type]}
         * @return {[type]}
         */
         fetchChannels: function (container) {
            // Remove old list from container
            container.find('ul').remove();
            // get channels with ajax
            var me = this;
            
            jQuery.ajax({
                type: 'GET',
                url: me.sandbox.getAjaxUrl() + 'action_route=SearchWFSChannel',
                success: function (data) {
                    me._createList(me, data.channels, me.state.filter);
                 },
                error: function (jqXHR, textStatus, errorThrown) {
                    var error = me._getErrorText(jqXHR, textStatus, errorThrown);

                     me._openPopup(
                         me._getLocalization('fetch_failed'),
                         error
                     );
                 }
            });
        },

        /**
         * @method _createList
         */
        _createList: function (me, channels, filter) {
            var list = me.templates.list.clone(),
                i,
                channel,
                hasFilter = filter !== null && filter !== undefined && filter.length > 0,
                matches;

            me.channels = channels;
            if(channels) {
                for (i = 0; i < channels.length; i += 1) {
                    channel = channels[i];
                    matches = !hasFilter || channel["details-topic-"+Oskari.getLang()].toLowerCase().indexOf(filter.toLowerCase()) > -1;
                    if (matches) {
                        list.append(
                            me._populateItem(
                                me.templates.item.clone(true, true),
                                channel
                            )
                        );
                    }
                }
            }
            // Add list to container
            me.container.append(list);
        },

        /**
         * @method _filterList
         */
        _filterList: function (event, me) {
            var filter = jQuery(event.target).parent().find('input[type=search]').val();
            me.state.filter = filter;
            me.fetchChannels(me.container);
        },

        /**
         * @method _getLocalization
         */
        _getLocalization: function (key) {
            return this._localization[key];
        },

        _getErrorText: function (jqXHR, textStatus, errorThrown) {
            var error = errorThrown.message || errorThrown;
            try {
                var err = JSON.parse(jqXHR.responseText).error;
                if (err !== null && err !== undefined) {
                    error = err;
                }
            } catch (e) {

            }
            return error;
        },

        /**
         * @method _deleteChannel
         * Gets channel id based on event target and deletes it
         */
        _deleteChannel: function (event, me) {
            var item = jQuery(event.target).parents('li'),
                uid = parseInt(item.attr('data-id')),
                channel = me._getChannel(uid);

            if (!window.confirm(me._getLocalization('confirm_delete').replace('{channel}', channel["details-topic-"+Oskari.getLang()]))) {
                return;
            }

            item.hide();
            jQuery.ajax({
                type: 'DELETE',
                url: me.sandbox.getAjaxUrl() + 'action_route=SearchWFSChannel&id='+ uid,
                error: function (jqXHR, textStatus, errorThrown) {
                    var error = me._getErrorText(jqXHR, textStatus, errorThrown);
                    me._openPopup(
                        me._getLocalization('delete_failed'),
                        error
                    );
                    item.show();
                },
                success: function (data) {
                    item.remove();
                    me.fetchChannels(me.container);
                }
            });
        },

        /**
         * @method _populateItem
         * Populates an item fragment
         */
        _populateItem: function (item, channel) {
            var me = this;

            item.attr('data-id', channel.id);
            item.find('h3').html(
                channel["details-topic-"+Oskari.getLang()]
            );
            return item;
        },

        /**
         * @method _getChannel
         * Gets channel by id
         */
        _getChannel: function (uid) {
            var i;
            for (i = 0; i < this.channels.length; i += 1) {
                if (this.channels[i].id === uid) {
                    return this.channels[i];
                }
            }
            return null;
        },

        /**
         * @method _openForm
         * Opens edit/create form depending on event target location
         */
        _openForm: function (event, instance) {
            // Semi deep clone
            var me = instance,
                form = me.templates.form.clone(true),
                target = jQuery(event.target),
                item = target.parents('li'),
                uid = item.attr('data-id');

            if (uid && uid.length) {
                target.hide();
                me._populateForm(form, me._getChannel(parseInt(uid, 10)));
                item.append(form);
                form.find('.delete--channel').removeClass('hidden');
            } else {
                target.hide();
                me._populateForm(form, null);
                me.container.prepend(form);
            }
        },

        /**
         * @method _closeForm
         * Closes given form and shows the button that opens it
         */
        _closeForm: function (form) {
            if (form.parent().is('li')) {
                // show edit button
                form.parent().find('.header input').show();
            } else {
                form.parent().find('> input').show();
            }
            // destroy form
            form.remove();
        },

        /**
         * @method _formIsValid
         * Validates given form. Checks that required fields have values and
         * that password field values match.
         */
        _formIsValid: function (form, me) {
            var errors = [],
                pass;
            // check that required fields have values
            form.find('input[required]').each(function (index) {
                if (!this.value.length) {
                    errors.push(
                        me._getLocalization('field_required').replace(
                            '{fieldName}',
                            this.name
                        )
                    );
                }
            });

            if (errors.length) {
                me._openPopup(
                    me._getLocalization('form_invalid'),
                    jQuery(
                        '<ul>' +
                        errors.map(function (value) {
                            return '<li>' + value + '</li>';
                        }).join('') +
                        '</ul>'
                    )
                );
            }
            return !errors.length;
        },

        /**
         * @method _submitForm
         * Submits event.target's form, updates list if submission is a success.
         */
        _submitForm: function (event, me) {
            event.preventDefault(); // We don't want the form to submit
            var frm = jQuery(event.target);

            if (me._formIsValid(frm, me)) {
                /**
                if (data.roles )
                    */
                jQuery.ajax({
                    type: frm.attr('method'),
                    url: me.sandbox.getAjaxUrl() + 'action_route=SearchWFSChannel'.
                    data: frm.serialize(),
                    success: function (data) {
                        me._closeForm(frm);
                        // FIXME fetch channels
                        me.fetchChannels(me.container);
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        var error = me._getErrorText(
                            jqXHR,
                            textStatus,
                            errorThrown
                        );
                        me._openPopup(
                            me._getLocalization('save_failed'),
                            error
                        );
                    }
                });
           }
            return false;
        },

        /**
         * @method _populateForm
         * Populates given form with given channel's data.
         */
        _populateForm: function (fragment, channel) {
            var me = this;
            fragment.find('fieldset:first-child input').not(':input[type=button]').each(function (index) {
                var el = jQuery(this), elName = "";
                    if(!el.hasClass('no-span-text')){
                        elName = el.attr('name');
                    }else{
                        elName = el.attr('language');
                    }
                if (channel) {
                    el.val(channel[elName]);
                }
            });
            if (channel) {
                // var select = fragment.find('select'),
                //     i;
                // for (i = 0; i < user.roles.length; i += 1) {
                //     var opt = select.find(
                //         'option[value=' + user.roles[i] + ']'
                //     );
                //     opt.attr('selected', 'selected');
                // }
                fragment.attr('method', 'POST');
            } else {
                fragment.attr('method', 'PUT');
            }

            fragment.submit(function (event) {
                return me._submitForm(event, me);
            });
            return fragment;
        },

        /**
         * @method _openPopup
         * opens a modal popup, no buttons or anything.
         */
        _openPopup: function (title, content) {
            var dialog = Oskari.clazz.create(
                    'Oskari.userinterface.component.Popup'
                ),
                okBtn = Oskari.clazz.create(
                    'Oskari.userinterface.component.buttons.OkButton'
                );

            okBtn.setPrimary(true);
            okBtn.setHandler(function () {
                dialog.close(true);
            });
            dialog.show(title, content, [okBtn]);
            dialog.makeModal();
        },

        /**
         * @method createUi
         * Creates the UI for a fresh start
         */
        createUi: function () {
            var me = this,
                btn = Oskari.clazz.create(
                    'Oskari.userinterface.component.buttons.AddButton'
                );

            me._initTemplates();
            me.container = me.templates.main.clone(true);
            me.fetchChannels(me.container);

            btn.setHandler(function (event) {
                me._openForm(event, me);
            });
            btn.insertTo(me.container);
            return me.container;
        }

    }, {
        extend: ['Oskari.userinterface.component.TabPanel']
    }
);
