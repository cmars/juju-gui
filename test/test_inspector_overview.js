/*
This file is part of the Juju GUI, which lets users view and manage Juju
environments within a graphical interface (https://launchpad.net/juju-gui).
Copyright (C) 2013 Canonical Ltd.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License version 3, as published by
the Free Software Foundation.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranties of MERCHANTABILITY,
SATISFACTORY QUALITY, or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero
General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
'use strict';

describe('Inspector Overview', function() {

  var view, service, db, models, utils, juju, env, conn, container, inspector,
      Y, jujuViews, ENTER, charmConfig, client, backendJuju, state, downgrades,
      exposeCalled, unexposeCalled;

  before(function(done) {
    var requires = ['juju-gui', 'juju-views', 'juju-tests-utils',
      'event-key', 'juju-charm-store', 'juju-charm-models'];
    Y = YUI(GlobalConfig).use(requires, function(Y) {
          ENTER = Y.Node.DOM_EVENTS.key.eventDef.KEY_MAP.enter;
          utils = Y.namespace('juju-tests.utils');
          models = Y.namespace('juju.models');
          jujuViews = Y.namespace('juju.views');
          juju = Y.namespace('juju');
          charmConfig = utils.loadFixture(
          'data/mediawiki-api-response.json',
          true);
          done();
        });

  });

  beforeEach(function() {
    exposeCalled = false;
    unexposeCalled = false;
    container = utils.makeContainer('container');
    conn = new utils.SocketStub();
    db = new models.Database();
    env = juju.newEnvironment({conn: conn});
    env.expose = function(s) {
      exposeCalled = true;
      service.set('exposed', true);
    };
    env.unexpose = function(s) {
      unexposeCalled = true;
      service.set('exposed', false);
    };
    env.connect();
    conn.open();
  });

  afterEach(function(done) {
    if (view) {
      if (inspector) {
        view.setInspector(inspector, true);
      }
      view.destroy();
    }
    env.after('destroy', function() { done(); });
    env.destroy();
    container.remove(true);

    if (client) {
      client.destroy();
    }
    if (backendJuju) {
      backendJuju.destroy();
    }
    if (state) {
      state.destroy();
    }
    window.flags = {};
  });

  var setUpInspector = function() {
    var charmId = 'precise/mediawiki-14';
    charmConfig.id = charmId;
    var charm = new models.Charm(charmConfig);
    db.charms.add(charm);
    service = new models.Service({
      id: 'mediawiki',
      charm: charmId,
      exposed: false,
      upgrade_available: true,
      upgrade_to: 'cs:precise/mediawiki-15'
    });
    downgrades = (function() {
      var versions = [];
      for (var version = 13; version > 0; version = version - 1) {
        versions.push('precise/mediawiki-' + version);
      }
      return versions;
    })();
    db.services.add(service);
    db.onDelta({data: {result: [
      ['unit', 'add',
        {id: 'mediawiki/0', agent_state: 'pending',
          charmUrl: 'cs:precise/mediaWiki-14'}],
      ['unit', 'add',
        {id: 'mediawiki/1', agent_state: 'pending',
          charmUrl: 'cs:precise/mediaWiki-14'}],
      ['unit', 'add',
        {id: 'mediawiki/2', agent_state: 'pending',
          charmUrl: 'cs:precise/mediaWiki-14'}]
    ]}});
    var fakeStore = new Y.juju.charmworld.APIv2({});
    fakeStore.iconpath = function(id) {
      return '/icon/' + id;
    };
    view = new jujuViews.environment({
      container: container,
      db: db,
      env: env,
      store: fakeStore
    });
    view.render();
    Y.Node.create([
      '<div id="content">'
    ].join('')).appendTo(container);
    inspector = view.createServiceInspector(service,
        {databinding: {interval: 0}});
    return inspector;
  };

  it('should show the proper icon based off the charm model', function() {
    inspector = setUpInspector();
    var icon = container.one('.icon img');

    // The icon url comes from the fake store and the service charm attribute.
    assert.equal(icon.getAttribute('src'), '/icon/precise/mediawiki-14');
  });

  it('should start with the proper number of units shown in the text field',
     function() {
       inspector = setUpInspector();
       var control = container.one('.num-units-control');
       control.get('value').should.equal('3');
     });

  it('should remove multiple units when the text input changes',
     function() {
       inspector = setUpInspector();
       var control = container.one('.num-units-control');
       control.set('value', 1);
       control.simulate('keydown', { keyCode: ENTER }); // Simulate Enter.
       var message = conn.last_message();
       assert.equal('DestroyServiceUnits', message.Request);
       assert.deepEqual(
       ['mediawiki/2', 'mediawiki/1'], message.Params.UnitNames);
     });

  it('should not do anything if requested is < 1',
     function() {
       setUpInspector();
       var control = container.one('.num-units-control');
       control.set('value', 0);
       control.simulate('keydown', { keyCode: ENTER });
       assert.isUndefined(conn.last_message());
       control.get('value').should.equal('3');
     });

  it('should add the correct number of units when entered via text field',
     function() {
       setUpInspector();
       var control = container.one('.num-units-control');
       control.set('value', 7);
       control.simulate('keydown', { keyCode: ENTER });
       // confirm the 'please confirm constraints' dialogue
       container.one('.confirm-num-units').simulate('click');
       assert.equal(container.one('.unit-constraints-confirm')
                       .one('span:first-child')
                       .getHTML(), 'Scale up with these constraints?');
       var message = conn.last_message();
       assert.equal('AddServiceUnits', message.Request);
       assert.equal('mediawiki', message.Params.ServiceName);
       assert.equal(4, message.Params.NumUnits);
     });

  it('should set the constraints before deploying any more units',
     function() {
       setUpInspector(true);
       var control = container.one('.num-units-control');
       control.set('value', 7);
       control.simulate('keydown', { keyCode: ENTER });
       var editConstraintsButton = container.one('.edit-constraints');
       editConstraintsButton.simulate('click');
       // It should be hidden after being clicked to display the constraints
       assert.equal(editConstraintsButton.getStyle('display'), 'none');
       var constraintsWrapper = container.one('.editable-constraints');
       assert.equal(constraintsWrapper.getStyle('display'), 'block');
       var constraints = {arch: 'amd64', 'cpu-cores': 4, mem: 8};
       Y.Object.each(constraints, function(value, key) {
          var node = constraintsWrapper.one('input[name=' + key + ']');
          node.set('value', value);
       });

       // confirm the 'please confirm constraints' dialogue
       container.one('.confirm-num-units').simulate('click');
       var message = conn.last_message();
       assert.equal('SetServiceConstraints', message.Request);
       assert.equal('mediawiki', message.Params.ServiceName);
       assert.deepEqual(constraints, message.Params.Constraints);
     });

  it('generates a proper statuses object', function() {
    var inspector = setUpInspector(),
        overview = inspector.viewletManager.viewlets.overview;

    // Clear out the units added in the setUpInspector method
    db.units.reset();

    var units = new Y.LazyModelList();

    var c = units.add({ id: 'mysql/2', agent_state: 'pending' }),
        d = units.add({ id: 'mysql/3', agent_state: 'started' }),
        e = units.add({
          id: 'mysql/4',
          agent_state: 'started',
          annotations: {
            'landscape-needs-reboot': 'foo'
          }
        }),
        a = units.add({ id: 'mysql/0', agent_state: 'install-error' }),
        b = units.add({ id: 'mysql/1', agent_state: 'install-error' });

    // This order is important.
    var expected = [
      { type: 'unit', category: 'error', units: [a, b] },
      { type: 'unit', category: 'pending', units: [c] },
      { type: 'unit', category: 'running', units: [d, e] },
      { type: 'unit', category: 'landscape-needs-reboot', units: [e]},
      { type: 'unit', category: 'landscape-security-upgrades', units: []}
    ];
    assert.deepEqual(overview.updateStatusList(units), expected);
  });

  it('can generate service update statuses (update)', function() {
    var inspector = setUpInspector(),
        overview = inspector.viewletManager.viewlets.overview;

    // Clear out the units added in the setUpInspector method
    db.units.reset();

    window.flags.upgradeCharm = true;

    var units = new Y.LazyModelList();

    var c = units.add({ id: 'mysql/2', agent_state: 'pending' }),
        d = units.add({ id: 'mysql/3', agent_state: 'started' }),
        e = units.add({
          id: 'mysql/4',
          agent_state: 'started',
          annotations: {
            'landscape-needs-reboot': 'foo'
          }
        }),
        a = units.add({ id: 'mysql/0', agent_state: 'install-error' }),
        b = units.add({ id: 'mysql/1', agent_state: 'install-error' });

    // This order is important.
    var expected = [
      { type: 'unit', category: 'error', units: [a, b] },
      { type: 'unit', category: 'pending', units: [c] },
      { type: 'service', category: 'upgrade-service',
        upgradeAvailable: true, upgradeTo: 'cs:precise/mediawiki-15',
        downgrades: downgrades
      },
      { type: 'unit', category: 'running', units: [d, e] },
      { type: 'unit', category: 'landscape-needs-reboot', units: [e]},
      { type: 'unit', category: 'landscape-security-upgrades', units: {}}
    ];
    assert.deepEqual(overview.updateStatusList(units), expected);
  });

  it('can generate service update statuses (no update)', function() {
    var inspector = setUpInspector(),
        overview = inspector.viewletManager.viewlets.overview;

    // Clear out the units added in the setUpInspector method
    db.units.reset();

    // Clear the service upgrade information.
    service.set('upgrade_available', false);
    service.set('upgrade_to', undefined);

    window.flags.upgradeCharm = true;

    var units = new Y.LazyModelList();

    var c = units.add({ id: 'mysql/2', agent_state: 'pending' }),
        d = units.add({ id: 'mysql/3', agent_state: 'started' }),
        e = units.add({
          id: 'mysql/4',
          agent_state: 'started',
          annotations: {
            'landscape-needs-reboot': 'foo'
          }
        }),
        a = units.add({ id: 'mysql/0', agent_state: 'install-error' }),
        b = units.add({ id: 'mysql/1', agent_state: 'install-error' });

    // This order is important.
    var expected = [
      { type: 'unit', category: 'error', units: [a, b] },
      { type: 'unit', category: 'pending', units: [c] },
      { type: 'unit', category: 'running', units: [d, e] },
      { type: 'unit', category: 'landscape-needs-reboot', units: [e]},
      { type: 'unit', category: 'landscape-security-upgrades', units: {}},
      { type: 'service', category: 'upgrade-service',
        upgradeAvailable: false, upgradeTo: undefined, downgrades: downgrades
      }
    ];
    assert.deepEqual(overview.updateStatusList(units), expected);
  });

  it('can generate service update statuses (no downgrades)', function() {
    var inspector = setUpInspector(),
        overview = inspector.viewletManager.viewlets.overview;

    // Clear out the units added in the setUpInspector method
    db.units.reset();

    // Clear the service upgrade information.
    service.set('charm', 'cs:precise/mysql-1')
    service.set('upgrade_available', false);
    service.set('upgrade_to', undefined);

    window.flags.upgradeCharm = true;

    var units = new Y.LazyModelList();

    var c = units.add({ id: 'mysql/2', agent_state: 'pending' }),
        d = units.add({ id: 'mysql/3', agent_state: 'started' }),
        e = units.add({
          id: 'mysql/4',
          agent_state: 'started',
          annotations: {
            'landscape-needs-reboot': 'foo'
          }
        }),
        a = units.add({ id: 'mysql/0', agent_state: 'install-error' }),
        b = units.add({ id: 'mysql/1', agent_state: 'install-error' });

    // This order is important.
    var expected = [
      { type: 'unit', category: 'error', units: [a, b] },
      { type: 'unit', category: 'pending', units: [c] },
      { type: 'unit', category: 'running', units: [d, e] },
      { type: 'unit', category: 'landscape-needs-reboot', units: [e]},
      { type: 'unit', category: 'landscape-security-upgrades', units: {}}
    ];
    assert.deepEqual(overview.updateStatusList(units), expected);
  });

  it('generates category names appropriately', function() {
    var outputInput = {
      'errored units': { type: 'unit', category: 'error', units: [] },
      'pending units': { type: 'unit', category: 'pending', units: [] },
      'running units': { type: 'unit', category: 'running', units: [] },
      'machines need to be restarted': { type: 'unit',
        category: 'landscape-needs-reboot', units: []},
      'security upgrades available': { type: 'unit',
        category: 'landscape-security-upgrades', units: []},
      'A new upgrade is available': { type: 'service',
        category: 'upgrade-service', upgradeAvailable: true,
        upgradeTo: 'cs:precise/mediawiki-5', downgrades: [
          'precise/mediawiki-3',
          'precise/mediawiki-2',
          'precise/mediawiki-1'
        ]
      },
      'Upgrade service': { type: 'service', category: 'upgrade-service',
        upgradeAvailable: false, upgradeTo: undefined, downgrades: [
          'precise/mediawiki-3',
          'precise/mediawiki-2',
          'precise/mediawiki-1'
        ]
      }
    };

    var inspector = setUpInspector(),
        overview = inspector.viewletManager.viewlets.overview;

    Y.Object.each(outputInput, function(value, key, obj) {
      assert.equal(overview.categoryName(value), key);
    });
  });

  it('generates the unit list data bound elements', function() {
    var inspector = setUpInspector(),
        overview = inspector.viewletManager.viewlets.overview,
        newContainer = utils.makeContainer();

    // Clear out the units added in the setUpInspector method
    db.units.reset();

    var units = new Y.LazyModelList();

    units.add({ id: 'mysql/0', agent_state: 'install-error' });
    units.add({ id: 'mysql/1', agent_state: 'install-error' });
    units.add({ id: 'mysql/2', agent_state: 'pending' });
    units.add({ id: 'mysql/3', agent_state: 'started' });

    var statuses = overview.updateStatusList(units);

    overview.generateAndBindStatusHeaders(
        newContainer, statuses, db.environment);

    var unitListWrappers = newContainer.all('.unit-list-wrapper');
    var SUH = '.status-unit-header',
        SUC = '.status-unit-content';

    assert.equal(unitListWrappers.size(), 5);
    var wrapper1 = unitListWrappers.item(0);
    assert.equal(wrapper1.one(SUH).hasClass('error'), true);
    assert.equal(wrapper1.one(SUH).hasClass('closed-unit-list'), true);
    assert.equal(wrapper1.one(SUC).hasClass('close-unit'), true);
    assert.equal(wrapper1.one('.unit-qty').getHTML(), 2);
    assert.equal(wrapper1.one('.category-label').getHTML(), 'errored units');
    assert.notEqual(wrapper1.one(SUC).getStyle('maxHeight'), undefined);

    var wrapper2 = unitListWrappers.item(1);
    assert.equal(wrapper2.one(SUH).hasClass('pending'), true);
    assert.equal(wrapper2.one(SUH).hasClass('closed-unit-list'), true);
    assert.equal(wrapper2.one(SUC).hasClass('close-unit'), true);
    assert.equal(wrapper2.one('.unit-qty').getHTML(), 1);
    assert.equal(wrapper2.one('.category-label').getHTML(), 'pending units');
    assert.notEqual(wrapper2.one(SUC).getStyle('maxHeight'), undefined);

    var wrapper3 = unitListWrappers.item(2);
    assert.equal(wrapper3.one(SUH).hasClass('running'), true);
    assert.equal(wrapper3.one(SUH).hasClass('closed-unit-list'), true);
    assert.equal(wrapper3.one(SUC).hasClass('close-unit'), true);
    assert.equal(wrapper3.one('.unit-qty').getHTML(), 1);
    assert.equal(wrapper3.one('.category-label').getHTML(), 'running units');
    assert.notEqual(wrapper3.one(SUC).getStyle('maxHeight'), undefined);

    var wrapper4 = unitListWrappers.item(3);
    assert.equal(wrapper4.hasClass('hidden'), true);

    var wrapper5 = unitListWrappers.item(4);
    assert.equal(wrapper5.hasClass('hidden'), true);

    units = new Y.LazyModelList();

    units.add({ id: 'mysql/0', agent_state: 'started' });
    units.add({ id: 'mysql/1', agent_state: 'pending' });
    units.add({ id: 'mysql/2', agent_state: 'pending' });
    units.add({ id: 'mysql/3', agent_state: 'pending' });
    units.add({ id: 'mysql/4', agent_state: 'pending' });
    units.add({ id: 'mysql/5', agent_state: 'pending' });

    statuses = overview.updateStatusList(units);

    overview.generateAndBindStatusHeaders(
        newContainer, statuses, db.environment);

    unitListWrappers = newContainer.all('.unit-list-wrapper');

    assert.equal(unitListWrappers.size(), 5);

    wrapper1 = unitListWrappers.item(0);
    assert.equal(wrapper1.hasClass('hidden'), true);

    wrapper2 = unitListWrappers.item(1);
    assert.equal(wrapper2.one(SUH).hasClass('pending'), true);
    assert.equal(wrapper2.one('.unit-qty').getHTML(), 5);
    assert.equal(wrapper2.one('.category-label').getHTML(), 'pending units');
    assert.notEqual(wrapper2.one(SUC).getStyle('maxHeight'), undefined);

    wrapper3 = unitListWrappers.item(2);
    assert.equal(wrapper3.one(SUH).hasClass('running'), true);
    assert.equal(wrapper3.one('.unit-qty').getHTML(), 1);
    assert.equal(wrapper3.one('.category-label').getHTML(), 'running units');
    assert.notEqual(wrapper3.one(SUC).getStyle('maxHeight'), undefined);

    wrapper4 = unitListWrappers.item(3);
    wrapper5 = unitListWrappers.item(4);

    assert.equal(wrapper4.hasClass('hidden'), true);
    assert.equal(wrapper5.hasClass('hidden'), true);

    newContainer.remove(true);
  });

  it('generates the service list data bound elements', function() {
    var inspector = setUpInspector(),
        overview = inspector.viewletManager.viewlets.overview,
        newContainer = utils.makeContainer();

    // Clear out the units added in the setUpInspector method
    db.units.reset();

    window.flags.upgradeCharm = true;

    var units = new Y.LazyModelList();

    units.add({ id: 'mysql/0', agent_state: 'install-error' });
    units.add({ id: 'mysql/1', agent_state: 'install-error' });
    units.add({ id: 'mysql/2', agent_state: 'pending' });
    units.add({ id: 'mysql/3', agent_state: 'started' });

    var statuses = overview.updateStatusList(units);

    overview.generateAndBindStatusHeaders(
        newContainer, statuses, db.environment);

    var unitListWrappers = newContainer.all('.unit-list-wrapper');
    var SUH = '.status-unit-header',
        SUC = '.status-unit-content';

    assert.equal(unitListWrappers.size(), 6);
    var serviceWrapper = unitListWrappers.item(2);
    assert.equal(serviceWrapper.one(SUH).hasClass('upgrade-service'), true);
    assert.equal(serviceWrapper.one(SUH).hasClass('closed-unit-list'), true);
    assert.equal(serviceWrapper.one(SUC).hasClass('close-unit'), true);
    assert.equal(serviceWrapper.one('.category-label').getHTML(),
        'A new upgrade is available');
    assert.notEqual(serviceWrapper.one(SUC).getStyle('maxHeight'), undefined);
    assert.equal(serviceWrapper.one(SUC).all('.top-upgrade').size(), 1);
    assert.equal(serviceWrapper.one(SUC).all('.other-charm').size(), 13);

    service.set('upgrade_available', false);
    service.set('upgrade_to', undefined);

    statuses = overview.updateStatusList(units);

    // Re-create the container; d3 is smart enough to keep the existing
    // ordering of the wrappers in this test.
    newContainer.remove(true);
    newContainer = utils.makeContainer();

    overview.generateAndBindStatusHeaders(
        newContainer, statuses, db.environment);

    unitListWrappers = newContainer.all('.unit-list-wrapper');

    assert.equal(unitListWrappers.size(), 6);

    serviceWrapper = unitListWrappers.item(5);
    assert.equal(serviceWrapper.one(SUH).hasClass('upgrade-service'), true);
    assert.equal(serviceWrapper.one(SUH).hasClass('closed-unit-list'), true);
    assert.equal(serviceWrapper.one(SUC).hasClass('close-unit'), true);
    assert.equal(serviceWrapper.one('.category-label').getHTML(),
        'Upgrade service');
    assert.notEqual(serviceWrapper.one(SUC).getStyle('maxHeight'), undefined);
    assert.equal(serviceWrapper.one(SUC).all('.top-upgrade').size(), 5);
    assert.equal(serviceWrapper.one(SUC).all('.other-charm').size(), 8);

    newContainer.remove(true);
  });

  it('attempts to upgrade on click', function(done) {
    var inspector = setUpInspector(),
        overview = inspector.viewletManager.viewlets.overview,
        newContainer = inspector.viewletManager.get('container');

    window.flags.upgradeCharm = true;

    // Ensure that get_charm is called to get the new charm.
    env.setCharm = function(serviceName, upgradeTo, force, callback) {
      callback({});
    };
    env.get_charm = function(upgradeTo, callback) {
      assert.equal(upgradeTo, newContainer.one('.upgrade-link')
        .getData('upgradeto'));
      done();
    };

    var statuses = overview.updateStatusList(service.get('units'));

    overview.generateAndBindStatusHeaders(
        newContainer, statuses, db.environment);

    newContainer.one('.upgrade-link').simulate('click');
  });

  it('reflects that a service was upgraded', function() {
    window.flags.upgradeCharm = true;
    var inspector = setUpInspector();
    var newContainer = inspector.viewletManager.viewlets.inspectorHeader
      .container;
    var unitId = 'mediawiki/1';

    var service = db.services.getById('mediawiki');

    assert.isFalse(service.get('charmChanged'));
    assert.isTrue(newContainer.one('.charm-changed').hasClass('hidden'));

    db.onDelta({data: {result: [
      ['unit', 'change', {id: unitId, charmUrl: 'cs:precise/mediawiki-15'}]
    ]}});

    assert.isTrue(service.get('charmChanged'));
    assert.isFalse(newContainer.one('.charm-changed').hasClass('hidden'));
  });

  it('toggles exposure', function() {
    inspector = setUpInspector();
    assert.isFalse(service.get('exposed'));
    assert.isFalse(exposeCalled);
    assert.isFalse(unexposeCalled);
    var vmContainer = inspector.viewletManager.get('container');
    var expose = vmContainer.one('label[for=expose-toggle]');
    expose.simulate('click');
    assert.isTrue(service.get('exposed'));
    assert.isTrue(exposeCalled);
    assert.isFalse(unexposeCalled);
    var checkedSelector = 'input.expose-toggle:checked ~ label .handle';
    var handle = vmContainer.one(checkedSelector);
    assert.equal(handle instanceof Y.Node, true);

    expose.simulate('click');
    assert.isTrue(unexposeCalled);
    assert.isFalse(service.get('exposed'));
    handle = vmContainer.one(checkedSelector);
    assert.equal(handle instanceof Y.Node, false);
  });

  describe('Unit action buttons', function() {
    it('sends the resolve cmd to the env for the selected units', function() {
      inspector = setUpInspector();
      var unitId = 'mediawiki/7';

      db.onDelta({data: {result: [
        ['unit', 'add', {id: unitId, agent_state: 'install-error'}]
      ]}});

      var mgrContainer = inspector.viewletManager.get('container');
      var retryButton = mgrContainer.one('button.unit-action-button.resolve');
      var unit = mgrContainer.one('input[type=checkbox][name=' + unitId + ']');

      assert.equal(retryButton instanceof Y.Node, true);
      assert.equal(unit instanceof Y.Node, true);

      unit.simulate('click');
      retryButton.simulate('click');

      var expected = {
        Params: {
          Retry: false,
          UnitName: 'mediawiki/7'
        },
        Request: 'Resolved',
        RequestId: 1,
        Type: 'Client'
      };
      assert.deepEqual(expected, env.ws.last_message());
    });

    it('sends the retry command to the env for the selected unit', function() {
      inspector = setUpInspector();
      var unitId = 'mediawiki/7';

      db.onDelta({data: {result: [
        ['unit', 'add', {id: unitId, agent_state: 'install-error'}]
      ]}});

      var mgrContainer = inspector.viewletManager.get('container');
      var retryButton = mgrContainer.one('button.unit-action-button.retry');
      var unit = mgrContainer.one('input[type=checkbox][name=' + unitId + ']');

      assert.equal(retryButton instanceof Y.Node, true);
      assert.equal(unit instanceof Y.Node, true);

      unit.simulate('click');
      retryButton.simulate('click');

      var expected = {
        Params: {
          Retry: true,
          UnitName: 'mediawiki/7'
        },
        Request: 'Resolved',
        RequestId: 1,
        Type: 'Client'
      };
      assert.deepEqual(env.ws.last_message(), expected);
    });

    it('sends the remove command to the env for the selected unit', function() {
      inspector = setUpInspector();
      var unitId = 'mediawiki/7';

      db.onDelta({data: {result: [
        ['unit', 'add', {id: unitId, agent_state: 'install-error'}]
      ]}});

      var mgrContainer = inspector.viewletManager.get('container');
      var removeButton = mgrContainer.one('button.unit-action-button.remove');
      var unit = mgrContainer.one('input[type=checkbox][name=' + unitId + ']');

      assert.equal(removeButton instanceof Y.Node, true,
          'removeButton is not an instance of Y.Node');
      assert.equal(unit instanceof Y.Node, true,
          'unit is not an instance of Y.Node');

      unit.simulate('click');
      removeButton.simulate('click');

      var expected = {
        Params: {UnitNames: 'mediawiki/7'},
        Request: 'DestroyServiceUnits',
        RequestId: 1,
        Type: 'Client'
      };
      assert.deepEqual(env.ws.last_message(), expected);
    });

    it('generates the button display map for each unit category', function() {
      inspector = setUpInspector();
      var buttons = {
        'error': {resolve: true, retry: true, remove: true},
        'pending': {retry: true, remove: true},
        'running': {remove: true},
        'landscape-needs-reboot': {landscape: true},
        'landscape-security-upgrades': {landscape: true}
      };
      var overview = inspector.viewletManager.viewlets.overview;
      Y.Object.each(buttons, function(results, category) {
        var buttonList = overview.generateActionButtonList(category);
        assert.deepEqual(buttonList, results);
      });
    });
  });

});
