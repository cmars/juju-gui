'use strict';

YUI.add('juju-models', function (Y) {

    var models = Y.namespace('juju.models');

    var Charm = Y.Base.create('charm', Y.Model, [], {
        idAttribute: 'charm_id',
        charm_id_re: /((\w+):)?(\w+)\/(\S+)-(\d+)/,
        parse_charm_id: function (id) {
            if (!id) {
                id = this.get('id');
            }
            return this.charm_id_re.exec(id);
        }
    }, {
        ATTRS: {
            charm_id: {},
            name: {
                valueFn: function (name) {
                    var match = this.parse_charm_id();
                    if (match) {
                        return match[3] + '/' + match[4];
                    }
                    return undefined;
                }
            },
            url: {},
            description: {},
            config: {},
            metadata: {},
            sha256: {}
        }
    });
    models.Charm = Charm;

    var CharmList = Y.Base.create('charmList', Y.ModelList, [], {
        model: Charm
    }, {
        ATTRS: {}
    });
    models.CharmList = CharmList;



    var Service = Y.Base.create('service', Y.Model, [], {
        ATTRS: {
            name: {},
            charm: {},
            config: {},
            constraints: {},
            exposed: {
                value: false
            },
            relations: {},
            unit_count: {},
            aggregated_status: {}
        }
    });
    models.Service = Service;

    var ServiceList = Y.Base.create('serviceList', Y.ModelList, [], {
        model: Service
    }, {
        ATTRS: {}
    });
    models.ServiceList = ServiceList;

    var ServiceUnit = Y.Base.create('serviceUnit', Y.Model, [], {},
    {
        ATTRS: {
            service: {
                valueFn: function (name) {
                    var unit_name = this.get('id');
                    return unit_name.split('/', 1)[0];
                }
            },
            urlName: {
                valueFn: function() {return this.get('id').replace("/", "-");}
            },
            machine: {},
            agent_state: {},
            // relations to unit relation state.
            relations: {},

            config: {},
            is_subordinate: {
                value: false // default
            },
            open_ports: {},
            public_address: {},
            private_address: {}
        }
    });
    models.ServiceUnit = ServiceUnit;

    var ServiceUnitList = Y.Base.create('serviceUnitList', Y.ModelList, [], {
        model: ServiceUnit,
        get_units_for_service: function (service, asList) {
            var options = {},
            sid = service.get('id');

            if (asList !== undefined) {
                options.asList = true;
            }

            var units = this.filter(options, function (m) {
                return m.get('service') == sid;
            });
            return units;
        },
        /*
         *  Return information about the state of the set of units for a
         *  given service in the form of a map of agent states:
         *  state => number of units in that state
         */
        get_informative_states_for_service: function (service) {
            var aggregate_map = {}, aggregate_list = [],
                units_for_service = this.get_units_for_service(service);

            units_for_service.forEach(function (unit) {
                var state = unit.get('agent_state');
                if (aggregate_map[state] === undefined) {
                    aggregate_map[state] = 1;
                }
                else {
                    aggregate_map[state]++;
                }

            });

            return aggregate_map;
        },

        /*
         * Updates a service's unit count and aggregate state map during a
         * delta, ensuring that they're up to date.
         */
        update_service_unit_aggregates: function (service) {
            var aggregate = this.get_informative_states_for_service(service);
            var sum = 0;
            for (var agent_state in aggregate) {
                sum += aggregate[agent_state];
            }
            service.set('unit_count', sum);
            service.set('aggregated_status', aggregate);
        },
        ATTRS: {}
    });
    models.ServiceUnitList = ServiceUnitList;

    var Machine = Y.Base.create('machine', Y.Model, [], {
        idAttribute: 'machine_id'
    }, {
        ATTRS: {
            machine_id: {},
            public_address: {},
            instance_id: {},
            instance_state: {},
            agent_state: {}
        }
    });
    models.Machine = Machine;

    var MachineList = Y.Base.create('machineList', Y.ModelList, [], {
        model: Machine
    }, {
        ATTRS: {}
    });
    models.MachineList = MachineList;

    var Relation = Y.Base.create('relation', Y.Model, [], {
        idAttribute: 'relation_id'
    }, {
        ATTRS: {
            relation_id: {},
            type: {},
            endpoints: {}
        }
    });
    models.Relation = Relation;

    var RelationList = Y.Base.create('relationList', Y.ModelList, [], {}, {
        ATTRS: {}
    });
    models.RelationList = RelationList;


    var Notification = Y.Base.create('notification', Y.Model, [], {}, {
        ATTRS: {
            title: {},
            message: {},
            level: {
                value: 'info'
            },
            kind: {},
            seen: {value: false},
            timestamp: {
                valueFn: function () {
                    return Y.Lang.now();
                }
            },

            // when a model id is set we can infer link (but only in the 
            // context of app's routing table)
            modelId: {
                setter: function(model) {
                    return Y.mix([model.name, model.get('id')]);
            }},
            link: {},
            link_title: {
                value: 'View Details'
            }
        }
    });
    models.Notification = Notification;

    var NotificationList = Y.Base.create('notificationList', Y.ModelList, [], {
        initializer: function () {
            NotificationList.superclass.constructor.apply(this, arguments);
            this.on('add', this.enforce_max_size);
        },
        model: Notification,
        comparator: function (model) {
            // timestamp desc
            return -model.get('timestamp');
        },

        enforce_max_size: function (e) {
            if (this.size() == this.get('max_size')) {
                this.remove_oldest_notification();
            }
        },

        remove_oldest_notification: function () {
            // The list is maintained in sorted order due to this.comparator
            // handle zero based index
            this.remove(this.size() - 1);
        },

        /*
         * Get Notifications relative to a given model.
         * Currenly this depends on a mapping between the model 
         * class as encoded by its clientId (see Database.getByModelId)
         * 
         * [model_list_name, id]
         */
        getNotificationsForModel: function (model) {
            var modelKey = model.get('id');
            return this.filter(function (notification) {
                var modelId = notification.get('modelId'),
                    modelList, modelId;
                    if (modelId) {
                        modelList = modelId[0],
                        modelId = modelId[1];                        
                        return (modelList == model.name) && (
                                modelId == modelKey);
                    }
                    return false;
            });
        }

    }, {
        ATTRS: {
            max_size: {
                value: 150,
                writeOnce: 'initOnly'
            }
        }
    });
    models.NotificationList = NotificationList;


    var Database = Y.Base.create('database', Y.Base, [], {
        initializer: function () {
            this.services = new ServiceList();
            this.machines = new MachineList();
            this.charms = new CharmList();
            this.relations = new RelationList();
            this.notifications = new NotificationList();

            // This one is dangerous.. we very well may not have capacity
            // to store a 1-1 representation of units in js.
            // At least we should never assume the collection is complete, and
            // have usage of some ephemeral slice/cursor of the collection.
            // Indexed db might be interesting to explore here, with object delta
            // and bulk transfer feeding directly into indexedb.
            // Needs some experimentation with a large data set.
            this.units = new ServiceUnitList();

            // For model syncing by type. Charms aren't currently sync'd, only 
            // fetched on demand (their static).
            this.model_map = {
                'unit': ServiceUnit,
                'machine': Machine,
                'service': Service,
                'relation': Relation,
                'charm': Charm
            };
        },

        /* 
         * Model Id is a [db[model_list_name], model.get('id')] 
         * sequence that can be used to lookup models relative 
         * to the Database.
         */
        getByModelId: function (modelId) {
            var modelList = modelId[0],
                id = modelId[1];

            //Normalize the name and resolve the list
            if (modelList == 'serviceUnit') {
                modelList = 'unit';
            }
            modelList = this[modelList + 's'];

            return modelList.getById(id);
        },

        getModelListForType: function(model_type) {
            return this[model_type + 's'];
        },

        getModelById: function (model_type, model_id) {
            var model_list = this.getModelListForType(model_type);
            if (!model_list) {
                console.error("No model list found for", model_type);
            }
            return model_list.getById(model_id);
        },

        getModelFromChange: function(change) {
            var change_type = change[0],
                change_kind = change[1],
                data = change[2],
                model_id = change_kind == 'delete' &&
                               data || data.id;
            return this.getModelById(change_type, model_id);
        },

        reset: function () {
            this.services.reset();
            this.machines.reset();
            this.charms.reset();
            this.relations.reset();
            this.units.reset();
        },

        on_delta: function (delta_evt) {
            var changes = delta_evt.data.result;
            console.groupCollapsed("Delta");
            console.log('Delta', this, changes);
            var change_type, model_class = null,
                self = this;

            changes.forEach(
            Y.bind(function (change) {
                change_type = change[0];
                model_class = this.model_map[change_type];

                if (!model_class) {
                    console.log('Unknown Change', change);
                }
                console.log('change', this, change);
                var model_list = this.getModelListForType(change_type);
                this.process_model_delta(change, model_class, model_list);
            }, this));
            this.services.each(function (service) {
                self.units.update_service_unit_aggregates(service);
            });
            this.fire('update');
            console.groupEnd();
        },

        // utility method to sync a data object and a model object.
        _sync_bag: function (bag, model) {
            // TODO: need to bulk mutate and then send mutation event,
            // as is this is doing per attribute events.
            var existing = model.getAttrs();
            var incoming = {};
            Y.each(bag, function(value, aid) {
                incoming[aid.replace('-', '_')] = value;
            });
            // Combine the attr space
            incoming = Y.merge(existing, incoming);
            model.setAttrs(incoming);
        },

        process_model_delta: function (change, ModelClass, model_list) {
            // console.log('model change', change);
            var change_kind = change[1],
                data = change[2],
                o = this.getModelFromChange(change);
            
            if (change_kind == 'add') {
                o = new ModelClass({id: data.id});
                this._sync_bag(data, o);
                model_list.add(o);
            }
            else if (change_kind == 'delete') {
                model_list.remove(o);
            }
            else if (change_kind == 'change') {
                this._sync_bag(data, o);
            }
        }

    });

    models.Database = Database;

    Y.namespace('juju').db = new Database({});

}, '0.1.0', {
    requires: [
        'model',
        'model-list',
        'lazy-model-list'
        ]
});
