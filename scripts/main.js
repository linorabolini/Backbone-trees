require.config({
	paths: {
		'jquery':'jquery-2.1.0.min',
		'underscore':'underscore-min',
		'backbone':'backbone-min',
		'two':'two',
		'datgui':'dat.gui'
	}
});

require(['jquery','underscore','backbone','two', 'datgui'], 
	function($, _, Backbone, Two) {

	//======================
	// config

	// game config defaults
	var config = {
		levels: 3,
		branches: 4,
		rotation: Math.PI * 0.5, 
		apperture: Math.PI * 0.25,
		size: 50,
		sizeMultiplier: 1.0,
		rotationMultiplier: 1.0,
		appertureMultiplier: 1.0,
		treeColor: '#000000',
		leafSize: 10,
		leafColor1:'#f0d0f7',
		leafColor2: '#e9ccf0',
		leafColor3: '#ebc0f5'
	};

	//======================
	// Two

	// init draw context
	var two = new Two({
			//type: Two.Types.webgl,
			autostart: true,
			fullscreen: true
		});

	//======================
	// Node

	var Node = Backbone.Model.extend({
		defaults: {
			children: null,
			parent: null,
			rotation: 0,
			apperture: 0,
			size: 0,
			x:0,
			y:0
		},

		initialize: function() {
			this.set('children', new NodeCollection());
		},

		setParent: function(newParent) {
			this.set('parent', newParent);
			this.refresh();
		},

		addNode: function(aNode) {
			aNode.setParent(this);
			return this.get('children').add(aNode);
		},

		refresh: function() {
			var parent = this.get('parent');
			var apperture = parent.get('apperture') * config.appertureMultiplier;
			var rotation = parent.get('rotation') * config.rotationMultiplier;
			rotation += Math.random() * 2 * apperture - apperture;
			var size = parent.get('size') * config.sizeMultiplier;
			this.set('size', size);
			var offset = {
				x: size * Math.cos(rotation),
				y: size * Math.sin(rotation)
			};
			this.set('rotation', rotation);
			this.set('apperture', apperture);
			this.setPosition(parent.get('x') + offset.x, parent.get('y') - offset.y );

			this.get('children').refresh();
		},

		removeNode: function(aNode) {
			return this.get('children').remove(aNode);
		},

		setPosition: function (x, y) {
			this.set('x', x);
			this.set('y', y);
		},

		dispose: function() {
			this.get('children').dispose();
			this.destroy();
		}
	});

	//======================
	// NodeCollection

	var NodeCollection = Backbone.Collection.extend({
		model:Node,

		refresh: function () {
			_.invoke(this.models, 'refresh');
		},

		dispose: function() {
			_.invoke(this.models, 'dispose');
		}
	});

	//======================
	// Branch

	var Branch = Backbone.Model.extend({
		defaults: {
			nodeA: null,
			nodeB: null,
			line: null
		},

		update: function(elapsed) {
	    	this.get('line').vertices[0].x = this.get('nodeA').get('x');
	        this.get('line').vertices[0].y = this.get('nodeA').get('y');
	        this.get('line').vertices[1].x = this.get('nodeB').get('x');
	        this.get('line').vertices[1].y = this.get('nodeB').get('y');
		},

		dispose: function() {
			two.remove(this.get('line'));
		}
	});


	//======================
	// BranchCollection

	var BranchCollection = Backbone.Collection.extend({
		model: Branch,

		update: function(elapsed) {
	    	 _.each(this.models, function (model) {
	    	 	model.update(elapsed);
	    	 });
		},

		dispose: function() {
			_.invoke(this.models, 'dispose');
		}
	});

	//======================
	// Leaf

	var Leaf = Backbone.Model.extend({
		defaults: {
			nodeA: null,
			view: null,
		},

		update: function(elapsed) {
	    	this.get('view').translation.x = this.get('nodeA').get('x');
	        this.get('view').translation.y = this.get('nodeA').get('y');
		},

		dispose: function() {
			two.remove(this.get('view'));
		}
	});


	//======================
	// LeavesCollection

	var LeafCollection = Backbone.Collection.extend({
		model: Leaf,

		update: function(elapsed) {
	    	 _.each(this.models, function (model) {
	    	 	model.update(elapsed);
	    	 });
		},

		dispose: function() {
			_.invoke(this.models, 'dispose');
		}
	});

	//======================
	// App

    var app = {

    	treeTop: null,
    	branches: null,
    	leaves: null,

    	init: function() {

    		_.bindAll(this, 'update');

	    	branches = new BranchCollection();
	    	leaves = new LeafCollection();

	    	this.treeTop = this.buildTree();
    		
    		two.bind('update', app.update);
    	},

    	buildTree: function () {

    		var tree = new Node({
    			size: config.size,
    			apperture: config.apperture,
    			rotation: config.rotation,
    			x: two.width * 0.5,
    			y: two.height * 0.5
    		});

    		this.addNodes(tree, config.levels, config.branches);

    		return tree;
    	},

    	createLeaf: function () {
    		var leaf = two.makeCircle(two.width / 2, two.height / 2, config.leafSize);
          	leaf.noStroke().fill = this.getLeafColor();
    		// body...
    		return leaf;
    	},

    	getLeafColor: function () {
    		
    		var n = Math.floor(Math.random() * 3 + 1);

    		return config['leafColor' + n];
    	},



    	addNodes: function(nodeA, level, qty) {
			if(level <= 0) {
				var view = this.createLeaf();
				var leaf = new Leaf({
					nodeA: nodeA,
					view: view
				});
				leaves.add(leaf);
				return;
			}
			
			for( var i=0; i < qty; ++i) {
				var lvl = level;
				var nodeB = new Node();
				this.joinNodes(nodeA, nodeB);
				if(Math.random() > 0.5) --lvl;
				this.addNodes(nodeB, --lvl, qty);
			};
    	},

    	joinNodes: function(nodeA, nodeB) {
			nodeA.addNode(nodeB);
			var line = two.makeLine(0,0,0,0);
			line.stroke = config.treeColor;
  			line.linewidth = (nodeA.get('size') + nodeB.get('size')) * 0.25 * 0.1;
  			line.curved = true;
			var branch = new Branch({
	    		nodeA: nodeA,
	    		nodeB: nodeB,
	    		line: line
	    	});

	    	branches.add(branch);
    	},

    	update: function(elapsed) {
    		branches.update(elapsed);
    		leaves.update(elapsed);
    	},

    	dispose: function() {
    		two.unbind('update', app.update);
    		branches.dispose();
    		leaves.dispose();
    	},

    	reset: function() {
    		this.dispose();
    		this.init();
    	}

    };

    // GUI 
	var gui = new dat.GUI();
	var f2 = gui.addFolder('config');
	f2.open();
		// tree config
		var f2_tree = f2.addFolder('Tree');
			f2_tree.add(config, 'levels', 1, 10);
			f2_tree.add(config, 'branches', 1, 10);
			f2_tree.add(config, 'apperture', 0, Math.PI);
			f2_tree.add(config, 'rotation', 0, Math.PI);
			f2_tree.add(config, 'size', 0, 150);
			f2_tree.addColor(config, 'treeColor');
		f2_tree.open();

		var f2_leaves = f2.addFolder('Leaves');
			f2_leaves.add(config, 'leafSize');
			f2_leaves.addColor(config, 'leafColor1');
			f2_leaves.addColor(config, 'leafColor2');
			f2_leaves.addColor(config, 'leafColor3');
		f2_leaves.open();

		var f2_multiplier = f2.addFolder('Multipliers');
			f2_multiplier.add(config, 'sizeMultiplier', 0, 1);
			f2_multiplier.add(config, 'rotationMultiplier', 0, 1);
			f2_multiplier.add(config, 'appertureMultiplier', 0, 1);
		f2_multiplier.open();




	var f1 = gui.addFolder('Comands');
		f1.add(app, 'reset');
	f1.open();



    //=================
	// START POINT
	two.appendTo(document.getElementById('game-container'));
	app.init();


});