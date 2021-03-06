/* Copyright (C) 2015 Canonical Ltd. */

'use strict';

chai.config.includeStack = true;
chai.config.truncateThreshold = 0;

describe('jujulib environment manager', function() {
  var env;

  var _makeXHRRequest = function(obj) {
    return {target: {responseText: JSON.stringify(obj)}};
  };

  afterEach(function () {
    env = null;
  });

  it('exists', function() {
    var bakery = {};
    env = new window.jujulib.jem('http://example.com/', bakery);
    assert.strictEqual(env instanceof window.jujulib.jem, true);
    assert.strictEqual(env.url, 'http://example.com/v2');
  });

  it('is smart enough to handle missing trailing slash in URL', function() {
    var bakery = {};
    env = new window.jujulib.jem('http://example.com', bakery);
    assert.strictEqual(env.url, 'http://example.com/v2');
  });

  it('lists models', function(done) {
    var bakery = {
      sendGetRequest: function(path, success, failure) {
        assert.equal(path, 'http://example.com/v2/model');
        var xhr = _makeXHRRequest({models: [{
          path: 'path',
          user: 'usr',
          password: 'passwd',
          uuid: 'unique',
          'controller-path': 'ctl-path',
          'controller-uuid': 'ctl-unique',
          'ca-cert': 'cert',
          'host-ports': ['http://1.2.3.4', 'http://localhost:17070']
        }]});
        success(xhr);
      }
    };
    env = new window.jujulib.jem('http://example.com/', bakery);
    env.listModels(function(error, data) {
      assert.strictEqual(error, null);
      assert.deepEqual(data, [{
        path: 'path',
        user: 'usr',
        password: 'passwd',
        uuid: 'unique',
        controllerPath: 'ctl-path',
        controllerUuid: 'ctl-unique',
        caCert: 'cert',
        hostPorts: ['http://1.2.3.4', 'http://localhost:17070']
      }]);
      done();
    });
  });

  it('handles errors listing models', function(done) {
    var err = 'bad wolf';
    var bakery = {
      sendGetRequest: function(path, success, failure) {
        assert.equal(path, 'http://example.com/v2/model');
        var xhr = _makeXHRRequest({Message: err});
        failure(xhr);
      }
    };
    env = new window.jujulib.jem('http://example.com/', bakery);
    env.listModels(function(error, data) {
      assert.equal(error, err);
      assert.strictEqual(data, null);
      done();
    });
  });

  it('lists controllers', function(done) {
    var bakery = {
      sendGetRequest: function(path, success, failure) {
        assert.equal(path, 'http://example.com/v2/controller')
        var xhr = _makeXHRRequest({controllers: [{
          path: 'path',
          'provider-type': 'aws',
          schema: 'schema',
          location: {'staging': 'yes'}
        }]});
        success(xhr);
      }
    };
    env = new window.jujulib.jem('http://example.com/', bakery);
    env.listControllers(function(error, data) {
      assert.strictEqual(error, null);
      assert.deepEqual(data, [{
        path: 'path',
        providerType: 'aws',
        schema: 'schema',
        location: {'staging': 'yes'}
      }]);
      done();
    });
  });

  it('handles errors listing controllers', function(done) {
    var err = 'bad wolf';
    var bakery = {
      sendGetRequest: function(path, success, failure) {
        assert.equal(path, 'http://example.com/v2/controller')
        var xhr = _makeXHRRequest({Message: err});
        failure(xhr);
      }
    };
    env = new window.jujulib.jem('http://example.com/', bakery);
    env.listControllers(function(error, data) {
      assert.equal(error, err);
      assert.strictEqual(data, null);
      done();
    });
  });

  it('gets model data', function(done) {
    var bakery = {
      sendGetRequest: function(path, success, failure) {
        assert.equal(path, 'http://example.com/v2/model/rose/fnord')
        var xhr = _makeXHRRequest({
          path: 'path',
          user: 'usr',
          password: 'passwd',
          uuid: 'unique',
          'controller-path': 'ctl-path',
          'controller-uuid': 'ctl-unique',
          'ca-cert': 'cert',
          'host-ports': ['http://1.2.3.4', 'http://localhost:17070']
        });
        success(xhr);
      }
    };
    env = new window.jujulib.jem('http://example.com/', bakery);
    env.getModel('rose', 'fnord', function(error, data) {
      assert.strictEqual(error, null);
      assert.deepEqual(data, {
        path: 'path',
        user: 'usr',
        password: 'passwd',
        uuid: 'unique',
        controllerPath: 'ctl-path',
        controllerUuid: 'ctl-unique',
        caCert: 'cert',
        hostPorts: ['http://1.2.3.4', 'http://localhost:17070']
      });
      done();
    });
  });

  it('handles errors getting model data', function(done) {
    var err = 'bad wolf';
    var bakery = {
      sendGetRequest: function(path, success, failure) {
        assert.equal(path, 'http://example.com/v2/model/rose/fnord')
        var xhr = _makeXHRRequest({Message: err});
        failure(xhr);
      }
    };
    env = new window.jujulib.jem('http://example.com/', bakery);
    env.getModel('rose', 'fnord', function(error, data) {
      assert.equal(error, err);
      assert.strictEqual(data, null);
      done();
    });
  });

  it('can create a new model providing a location', function(done) {
    var bakery = {
      sendPostRequest: function(path, data, success, failure) {
        assert.equal(path, 'http://example.com/v2/model/rose');
        assert.deepEqual(JSON.parse(data), {
          name: 'fnord',
          Location: {'region': 'us-east-1', 'cloud': 'aws'},
          templates: ['rose/template']
        });
        var xhr = _makeXHRRequest({
          path: 'path',
          user: 'usr',
          password: 'passwd',
          uuid: 'unique',
          'controller-path': 'ctl-path',
          'controller-uuid': 'ctl-unique',
          'ca-cert': 'cert',
          'host-ports': ['http://1.2.3.4', 'http://localhost:17070']
        });
        success(xhr);
      }
    };

    env = new window.jujulib.jem('http://example.com/', bakery);
    var location = {'region': 'us-east-1', 'cloud': 'aws'};
    env.newModel('rose', 'fnord', 'rose/template', location, null,
      function(error, data) {
        assert.strictEqual(error, null);
        assert.deepEqual(data, {
          path: 'path',
          user: 'usr',
          password: 'passwd',
          uuid: 'unique',
          controllerPath: 'ctl-path',
          controllerUuid: 'ctl-unique',
          caCert: 'cert',
          hostPorts: ['http://1.2.3.4', 'http://localhost:17070']
        });
        done();
      }
    );
  });

  it('can create a new model providing a controller', function(done) {
    var bakery = {
      sendPostRequest: function(path, data, success, failure) {
        assert.equal(path, 'http://example.com/v2/model/rose');
        assert.deepEqual(JSON.parse(data), {
          name: 'fnord',
          controller: 'ctl',
          templates: ['rose/template']
        });
        var xhr = _makeXHRRequest({
          path: 'path',
          user: 'usr',
          password: 'passwd',
          uuid: 'unique',
          'controller-path': 'ctl-path',
          'controller-uuid': 'ctl-unique',
          'ca-cert': 'cert',
          'host-ports': ['http://1.2.3.4', 'http://localhost:17070']
        });
        success(xhr);
      }
    };

    env = new window.jujulib.jem('http://example.com/', bakery);
    env.newModel('rose', 'fnord', 'rose/template', null, 'ctl',
      function(error, data) {
        assert.strictEqual(error, null);
        assert.deepEqual(data, {
          path: 'path',
          user: 'usr',
          password: 'passwd',
          uuid: 'unique',
          controllerPath: 'ctl-path',
          controllerUuid: 'ctl-unique',
          caCert: 'cert',
          hostPorts: ['http://1.2.3.4', 'http://localhost:17070']
        });
        done();
      }
    );
  });

  it('handles errors creating a new model', function(done) {
    var err = 'bad wolf';
    var bakery = {
      sendPostRequest: function(path, data, success, failure) {
        assert.equal(path, 'http://example.com/v2/model/rose');
        var xhr = _makeXHRRequest({Message: err});
        failure(xhr);
      },
    };

    env = new window.jujulib.jem('http://example.com/', bakery);
    env.newModel('rose', 'fnord', 'rose/template', {}, null,
      function(error, data) {
        assert.equal(error, err);
        assert.strictEqual(data, null);
        done();
      }
    );
  });

  it('retrieves clouds', function(done) {
    var bakery = {
      sendGetRequest: function(path, success, failure) {
        assert.equal(path, 'http://example.com/v2/location/cloud')
        var xhr = _makeXHRRequest({Values: ['aws', 'ec2']});
        success(xhr);
      }
    };
    env = new window.jujulib.jem('http://example.com/', bakery);
    env.listClouds(function(error, data) {
      assert.strictEqual(error, null);
      assert.deepEqual(data, ['aws', 'ec2']);
      done();
    });
  });

  it('handles errors retrieving clouds', function(done) {
    var bakery = {
      sendGetRequest: function(path, success, failure) {
        assert.equal(path, 'http://example.com/v2/location/cloud')
        var xhr = _makeXHRRequest({Message: 'bad wolf'});
        failure(xhr);
      }
    };
    env = new window.jujulib.jem('http://example.com/', bakery);
    env.listClouds(function(error, data) {
      assert.equal(error, 'bad wolf');
      assert.strictEqual(data, null);
      done();
    });
  });

  it('retrieves regions for a cloud', function(done) {
    var bakery = {
      sendGetRequest: function(path, success, failure) {
        assert.equal(path, 'http://example.com/v2/location/region?cloud=aws')
        var xhr = _makeXHRRequest({
          Values: ['eu-east-1', 'moon-serenity-42']
        });
        success(xhr);
      }
    };
    env = new window.jujulib.jem('http://example.com/', bakery);
    env.listRegions('aws', function(error, data) {
      assert.strictEqual(error, null);
      assert.deepEqual(data, ['eu-east-1', 'moon-serenity-42']);
      done();
    });
  });

  it('handles errors retrieving regions', function(done) {
    var bakery = {
      sendGetRequest: function(path, success, failure) {
        assert.equal(path, 'http://example.com/v2/location/region?cloud=lxd')
        var xhr = _makeXHRRequest({Message: 'bad wolf'});
        failure(xhr);
      }
    };
    env = new window.jujulib.jem('http://example.com/', bakery);
    env.listRegions('lxd', function(error, data) {
      assert.equal(error, 'bad wolf');
      assert.strictEqual(data, null);
      done();
    });
  });

  it('identifies the current user', function(done) {
    var currentUser = {user: 'test'};
    var bakery = {
      sendGetRequest: function(path, success, failure, redirect) {
        assert.equal(path, 'http://example.com/v2/whoami');
        // Make sure that we have disabled redirect on 401
        assert.strictEqual(redirect, false);
        var xhr = _makeXHRRequest(currentUser);
        success(xhr);
      },
    };

    env = new window.jujulib.jem('http://example.com/', bakery);
    env.whoami(
      function(error, data) {
        assert.strictEqual(error, null);
        assert.deepEqual(data, currentUser);
        done();
      }
    );
  });

  it('lists templates', function(done) {
    var response = {templates: [{
      path: 'rose/template',
      schema: 'schema',
      config: 'config'
    }]};
    var bakery = {
      sendGetRequest: function(path, success, failure, redirect) {
        assert.equal(path, 'http://example.com/v2/template');
        var xhr = _makeXHRRequest(response);
        success(xhr);
      },
    };

    env = new window.jujulib.jem('http://example.com/', bakery);
    env.listTemplates(
      function(error, data) {
        assert.strictEqual(error, null);
        assert.deepEqual(data, response.templates);
        done();
      }
    );
  });

  it('handles zero templates', function(done) {
    var response = {templates: null};
    var bakery = {
      sendGetRequest: function(path, success, failure, redirect) {
        assert.equal(path, 'http://example.com/v2/template');
        var xhr = _makeXHRRequest(response);
        success(xhr);
      },
    };

    env = new window.jujulib.jem('http://example.com/', bakery);
    env.listTemplates(
      function(error, data) {
        assert.strictEqual(error, null);
        assert.deepEqual(data, []);
        done();
      }
    );
  });

  it('handles errors listing templates', function(done) {
    var err = 'bad wolf';
    var bakery = {
      sendGetRequest: function(path, success, failure, redirect) {
        assert.equal(path, 'http://example.com/v2/template')
        var xhr = _makeXHRRequest({Message: err});
        failure(xhr);
      }
    };

    env = new window.jujulib.jem('http://example.com/', bakery);
    env.listTemplates(function(error, data) {
      assert.equal(error, err);
      assert.strictEqual(data, null);
      done();
    });
  });

  it('can add a template', function(done) {
    var bakery = {
      sendPutRequest: function(path, data, success, failure, redirect) {
        assert.equal(path, 'http://example.com/v2/template/rose/mytmpl');
        assert.deepEqual(JSON.parse(data), {controller: 'ctl'});
        success(_makeXHRRequest());
      },
    };

    env = new window.jujulib.jem('http://example.com/', bakery);
    env.addTemplate('rose', 'mytmpl', {controller: 'ctl'}, function(error) {
      assert.strictEqual(error, null);
      done();
    });
  });

  it('handles errors adding templates', function(done) {
    var err = 'bad wolf';
    var bakery = {
      sendPutRequest: function(path, data, success, failure, redirect) {
        assert.equal(path, 'http://example.com/v2/template/rose/mytmpl')
        assert.deepEqual(JSON.parse(data), {controller: 'ctl'});
        var xhr = _makeXHRRequest({Message: err});
        failure(xhr);
      }
    };

    env = new window.jujulib.jem('http://example.com/', bakery);
    env.addTemplate('rose', 'mytmpl', {controller: 'ctl'}, function(error) {
      assert.strictEqual(error, err);
      done();
    });
  });

  it('can delete a template', function(done) {
    var bakery = {
      sendDeleteRequest: function(path, success, failure, redirect) {
        assert.equal(path, 'http://example.com/v2/template/rose/template');
        success(_makeXHRRequest());
      },
    };

    env = new window.jujulib.jem('http://example.com/', bakery);
    env.deleteTemplate('rose', 'template', function(error) {
      assert.strictEqual(error, null);
      done();
    });
  });

  it('handles errors deleting templates', function(done) {
    var err = 'bad wolf';
    var bakery = {
      sendDeleteRequest: function(path, success, failure, redirect) {
        assert.equal(path, 'http://example.com/v2/template/rose/template')
        var xhr = _makeXHRRequest({Message: err});
        failure(xhr);
      }
    };

    env = new window.jujulib.jem('http://example.com/', bakery);
    env.deleteTemplate('rose', 'template', function(error) {
      assert.strictEqual(error, err);
      done();
    });
  });

});
