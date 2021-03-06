var osm_map;
var zoom = 14;
var eps4326; 
var dataLayer;
var linkmap = {};
var nodemap = {};
var busroutes = [];
var link_data = 0;
var node_data = 0;

var link_offset_WCS = 0.0001;
var display_offset_links;

var current_timestep 	 = 0;
var number_of_timesteps = 0;

var osm = 0;

var node_ids   				= [];
var node_types 				= [];
var node_locations 			= [];
var node_type_set 			= [];
var node_colors 			= [];

var node_attributes			= [];
var node_features   		= [];

var	link_ids   				= [];
var	link_types 				= [];
var	link_paths				= [];
var link_type_set 			= [];
var link_colors 			= [];

var	link_attributes			= [];
var link_features   		= []
var offset_link_features 	= [];

var path_datasets       	= [];
var path_origins			= [];
var path_destinations		= [];

var popups_on       = true;

var animation_delay 	= 1;
var animation_running 	= false;

var path_destination_node = -1;
var path_origin_node      = -1;

var path_properties = [];

$(document).ready(function() {

	load_network(network_name);
	
	osm_map = new OpenLayers.Map("map");
	eps4326 = new OpenLayers.Projection("EPSG:4326");

	osm = new OpenLayers.Layer.OSM();
	osm.tileOptions.crossOriginKeyword = 'null';
	osm_map.addLayers([osm]);
    
	dataLayer = new OpenLayers.Layer.Vector("DataLayer", {
									eventListeners: {
										'featureselected': click_on_feature,
										'featureunselected': popdown
									}
								});
									
	osm_map.addLayers([dataLayer]);
	
    var selectControl = new OpenLayers.Control.SelectFeature(dataLayer, {});
	osm_map.addControl(selectControl);
    selectControl.activate();

	osm_map.setCenter(new OpenLayers.LonLat(-97.7402, 30.275).transform(eps4326, osm.projection), zoom); 

	$( "#dialog" ).dialog({autoOpen: false});
});

function resize_map()
{
    main_container = document.getElementById('main_container')
    main_container_height = main_container.offsetHeight
    
    map = document.getElementById('map')
    map_offset = map.offsetTop
    
    new_height = main_container_height - map_offset
    
    map.style.height = new_height + "px"
    osm_map.updateSize()
}
  
function attribute_minmax(attr)
{
	m =  Number.MAX_VALUE
    M = -Number.MAX_VALUE
    
    for (var i in attr.data)
    {
        mm = Math.min.apply(null, attr.data[i])
        MM = Math.max.apply(null, attr.data[i])
        if (m > mm) m = mm
        if (M < MM) M = MM
    }
    
    attr['range'] = [m,M]
}

function post_node_types(types)
{
	str = ''
	for (var i in types)
	  str += '<input type="checkbox" name="nodetypes" value=' + types[i] + ' checked="yes" onclick="redraw()">' + types[i] + '<br>'
	
	document.getElementById('nodeTypes').innerHTML = str;

}

function post_link_types(types)
{
	str = ''
	for (var i in types)
	  str += '<input type="checkbox" name="linktypes" value=' + types[i] + ' checked="yes" onclick="redraw()">' + types[i] + '<br>'
	
	document.getElementById('linkTypes').innerHTML = str;

}

function post_busroutes(routes)
{
	str = ''
	for (var rte in routes)
	{
	    str += '<div style="width:45px;height:20px;float:left;position:relative">'
	    str += '  <input type="checkbox" name="busroutes" value="' + rte + '" checked="yes" onclick=redraw() >' + rte
	    str += '</div>'
	}
	
	document.getElementById('busroutes').innerHTML = str;
}

function receive_network(data)
{
	nodemap 		= {}
	
	for (var n in data.nodes)
	{
		node = data.nodes[n]
		node_features.push(create_node_feature(node[0], node[1], node[2]))
		nodemap[node[0]] = n;
	}

	post_node_types(data.nodeTypes)
	
	for (var varname in data.nodeAttributes)
	{
		attribute = data.nodeAttributes[varname]
		attribute_minmax(attribute)
		node_attributes[varname] = attribute
	}
	
	post_node_color_options("constant")
	 
	linkmap         = {}
	
	for (var l in data.links)
	{
		link = data.links[l]
		
		link_features.push(create_link_feature(link[0], link[1], link[4], false))
		offset_link_features.push(create_link_feature(link[0], link[1], link[4], true))
		
		linkmap[link[0]] = l;
	}
	        	
	post_link_types(data.linkTypes)

	for (var varname in data.linkAttributes)
	{
		attribute = data.linkAttributes[varname]
		attribute_minmax(attribute)
		link_attributes[varname] = attribute
	}
	
	busroutes = data.busroutes
	post_busroutes(busroutes)
	
	post_link_color_options("constant")		
	post_path_data_options("")
	
	color_links()
	color_nodes()
	
	redraw();
}
	
function load_network()
{
	$.ajax({
		url: '/network/load_network/' + network_name,
		dataType : 'json',
		cache: false,
		success: receive_network
		});
}

function stop_animation()
{
	stop_flag = true;
}

function animation_toggle()
{
	if (animation_running == true)
	{
	    animation_running = false
	    document.getElementById('animation_button').value = 'Run '
	}
	else
	{
		set_current_timestep(0)
		animation_running = true
		document.getElementById('animation_button').value = 'Stop'
		animate()
	}
}

function increment_current_timestep()
{
	set_current_timestep(current_timestep+1)
}

function set_current_timestep(n)
{
	current_timestep = n
    document.getElementById('current_timestep').innerHTML = n
}

function get_current_timestep()
{
	return current_timestep;
}


function animate()
{
	if (animation_running)
	{
		if (get_current_timestep() >= (number_of_timesteps-1))
		{
			animation_toggle()
		}
		else
		{
			color_links()
			color_nodes()
			redraw()
			increment_current_timestep()
			setTimeout(animate, animation_delay);
		}
	}
}
   
var current_popup_feature = null;  

function show_popups(v)
{
	popups_on = v;
}

function click_on_feature(evt)
{
    if (current_popup_feature != null)
	    popdown(evt)
    
    if (popups_on)
    {
		feature = evt.feature;
		
		var s;
		
		if (feature.type == 'link')
	    {
	        link = feature.link;
	        s = "link " + link_ids[link];
	        for (var a in link_attributes)
	        {
	        	data = link_attributes[a].data
	        	if (data.length == 1)
	        		v = link_attributes[a].data[0][link]
	        	else
	        		v = link_attributes[a].data[get_current_timestep()][link]
	            s = s + '<br>    ' + a + ": " + v;
	        }
	    }
	    else
	    {            
	        node = feature.node;
	        s = "node " + node_ids[node] + '<br>Lat: ' + node_locations[node][1] + ' Lon: ' + node_locations[node][0]
	        for (var a in node_attributes)
	            s = s + '<br>    ' + a + ": " + node_attributes[a].data[get_current_timestep()][node];
	    }       
	            
		var popup = new OpenLayers.Popup.FramedCloud("popup", 
						OpenLayers.LonLat.fromString(feature.popup_location.toShortString()),
						null,
	                    "<div style='font-size:.8em'>" + s + "</div>",
	                    null,
	                    true
	                );
	                
	    feature.popup = popup;
	    osm_map.addPopup(popup);
	    
	    current_popup_feature = feature;
	}
	else if (path_mode == 0)
	{
		path_mode = 1
		path_origin_node = evt.feature.feature_id
	    document.getElementById('path_origin').value = path_origin_node
	    
	    load_path_destinations()
	}
	else 
	{
		path_mode = 2
		path_destination_node = evt.feature.feature_id
	    document.getElementById('path_destination').value = path_destination_node
	    
	    load_paths()
	}
}

function popdown(evt)
{
	if (current_popup_feature != null)
	{
    	osm_map.removePopup(current_popup_feature.popup);
    	current_popup_feature.popup.destroy();
    	current_popup_feature.popup = null;
   		current_popup_feature = null;
   	}
}

function post_link_color_options(which)
{
	if (which == "" || which == "constant")
		s = '<option value="constant" selected>constant</option>';
	else
		s = '<option value="constant">constant</option>';
	
	for (var a in link_attributes)
	    if (a == which)
			s = s + '<option value="' + a + '" selected>' + a + '</option>';
		else
			s = s + '<option value="' + a + '">' + a + '</option>';
		
	document.getElementById('link_color_select').innerHTML = s;
}

function post_path_data_options(which)
{
	var html_string;
    if (path_data_select.length == 0)
		html_string = '<option value="none" selected>(none)</option>';
    else
    {
    	html_string = ""
    	for (var a in path_datasets)
    	{
    	    d = path_datasets[a]
		    if (which != "" && d == which)
				html_string = html_string + '<option value="' + d + '" selected>' + d + '</option>';
			else
				html_string = html_string + '<option value="' + d + '">' + d + '</option>';
		}
    }

	document.getElementById('path_data_select').innerHTML = html_string;
}
function post_node_color_options(which)
{	
	if (which == "" || which == "constant")
		s = '<option value="constant" selected>constant</option>';
	else
		s = '<option value="constant">constant</option>';
	
	for (var a in node_attributes)
	    if (which == a)
			s = s + '<option value="' + a + '" selected>' + a + '</option>';
		else
			s = s + '<option value="' + a + '">' + a + '</option>';

	document.getElementById('node_color_select').innerHTML = s;
}

function post_path_color_options(which)
{	
	if (which == "" || which == "link data")
		s = '<option value="link data" selected>link data</option>';
	else
		s = '<option value="link data">link_data</option>';
	
	for (var a in node_attributes)
	    if (which == a)
			s = s + '<option value="' + a + '" selected>' + a + '</option>';
		else
			s = s + '<option value="' + a + '">' + a + '</option>';

	document.getElementById('path_color_select').innerHTML = s;
}

function create_node_feature(id, type, location)
{
	geometry = new OpenLayers.Geometry.Point(location[0], location[1]).transform(eps4326, osm.projection);
	feature = new OpenLayers.Feature.Vector(geometry, null, {
													fillColor: "#ff0000", 
													fillOpacity: 0.2,
													strokeColor: "#ff0000",
													strokeOpacity: 1,
													strokeWidth: 1,
													pointRadius: '4'
												});

    feature.popup_location 	= geometry;
	feature.feature_id		= id;
	feature.type 			= 'node';
	feature.nodeType 		= type;
	return feature;
}

function create_link_feature(id, type, path, offset)
{
	var feature_path;
	
	if (offset)
		feature_path = offset_path(path, link_offset_WCS);
	else
		feature_path = path;
	
	pointArray = [];
	for (var p in feature_path)
	{
		try
		{
			pt = feature_path[p]
			g = new OpenLayers.Geometry.Point(pt[0], pt[1]).transform(eps4326, osm.projection);
			pointArray.push(g); 
		} catch(e) {
			console.log('create_link_feature')
		}
	}
	
	linestring     = new OpenLayers.Geometry.LineString(pointArray);
	feature        = new OpenLayers.Feature.Vector(linestring, null, {
												strokeColor: "#ff0000",
												strokeOpacity: 1,
												strokeWidth: 2});
												
	p0 = path[ 0];
	p1 = path[path.length-1];
	p = [(p0[0] + p1[0]) / 2.0, (p0[1] + p1[1]) / 2.0];
	
	feature.popup_location = new OpenLayers.Geometry.Point(p[0], p[1]).transform(eps4326, osm.projection);
	
	feature.feature_id 		=  id;
	feature.type 			= 'link';
	feature.linkType 		= type;
	feature.isOffset		= offset;
	
	return feature;
}

function color_feature(feature, color)
{
	feature.style['strokeColor'] = color;
	feature.style['fillColor'] = color;
}

function color_features(features, color)
{
	for (var i in features)
		color_feature(features[i], color);
}

function color_features_by_attribute(features, map, attribute, timestep)
{
	vmin = attribute['range'][0]
	vmax = attribute['range'][1]
	
	color_features(features, '')
	  
	timestep_data = attribute.data[timestep]
	for (var i in attribute.ids)
	{
	  	indx = map[attribute.ids[i]]
		color_feature(features[indx], val_to_color(timestep_data[i], vmin, vmax));
	}
}

function get_path_properties(origin, destination)
{
	path_properties = {}
	selected_path_data = path_datasets[document.getElementById('path_data_select').value]
	
	var min_count = 9999999999
	var min_time = 9999999999
	var max_count = 0
	var max_time = 0
	
	path_timestep_properties = []
	for (var ti in selected_path_data)
	{
		timestep_data = selected_path_data[ti]
		
	    ids = []
		count   = []
		time    = []
	
		origin = timestep_data.data[path_origin_node]
		if (typeof(origin) !== 'undefined')
		{
			path_list = origin[path_destination_node]
			if (typeof(path_list) !== 'undefined')
			{
				if (typeof(path_list) !== 'undefined')
				{
					for (var path in path_list)
					{
					    var path_data = path_list[path]
					    var path_links = path.split(',')
					    
						for (var li in path_links)
						{
							path_link = path_links[li]
							indx = ids.indexOf(path_link)
							
						    if (indx == -1)
						    {
						    	ids.push(path_link)
						    	count.push(path_data[0])
						    	time.push(path_data[1])
						    }
						    else
						    {
						    	count[indx] = count[indx] + path_data[0]
						    	if (time[indx] < path_data[1])
						    		time[indx] = path_data[1]
						    }
						}
					}
				}
			}
		}
		
		path_timestep_properties.push({'ids': ids, 'counts': count, 'max_times': time})
		
		for (var indx = 0; indx < ids.length; indx ++)
		{
		    if (count[indx] > max_count) max_count = count[indx];
		    if (time[indx]  > max_time)  max_time = time[indx];
		    if (count[indx] < min_count) min_count = count[indx];
		    if (time[indx]  < min_time)  min_time = time[indx];
		}
	}
	
	path_properties = {'max_count': max_count, 
					   'max_time': max_time, 
					   'min_count': min_count, 
					   'min_time': min_time, 
					   'timesteps': path_timestep_properties}
}

function color_paths_by_path_attribute(how, timestep)
{
	if (how == 'count')
	{
		vmax = path_properties['max_count']
		vmin = path_properties['min_count']

		timestep_data = path_properties.timesteps[timestep]
		for (var i in timestep_data.ids)
		{
			l = timestep_data.ids[i]
		    c = timestep_data.counts[i]
	  		color_feature(link_features[linkmap[l]], val_to_color(c, vmin, vmax));
		}
	}
	else
	{
		vmax = path_properties['max_time']
		vmin = path_properties['min_time']

		timestep_data = attribute.data[timestep]
		for (var i in attribute.ids)
		{
			l = timestep_data.ids[i]
		    t = timestep_data.max_times[i]
	  		color_feature(link_features[linkmap[l]], val_to_color(c, vmin, vmax));
		}
	}
}

function path_color_selection()
{
    if (document.getElementById('path_color_select').value == 'link data')
    	link_color_selection()
    else 
    {
        number_of_timesteps = path_datasets[document.getElementById('path_data_select').value].length
        set_current_timestep(0)

        if (number_of_timesteps > 1)
			document.getElementById('animation_button').disabled = false;
		else
			document.getElementById('animation_button').disabled = true;
        
        color_links()
        redraw()
    }

  	redraw()
}

function color_links()
{
	color_features(link_features, "")
	color_features(offset_link_features, "")
		
	selected_attribute_name = document.getElementById('link_color_select').value

	if (document.getElementById("selection_type_paths").checked)
	{
		how = document.getElementById('path_color_select').value
		if (how == 'link data')
		{
			if (selected_attribute_name == 'constant') 
				color_features(link_features, "#ff0000")
			else
				color_features_by_attribute(link_features, linkmap, link_attributes[selected_attribute_name], get_current_timestep())
		}
		else
		    color_paths_by_path_attribute(how, get_current_timestep())
	}
	else if (selected_attribute_name == 'constant') 
		color_features(offset_link_features, "#ff0000")
	else 
		color_features_by_attribute(offset_link_features, linkmap, link_attributes[selected_attribute_name], get_current_timestep())
}

function link_color_selection()
{
	selected_attribute_name = document.getElementById('link_color_select').value;
	
	if (selected_attribute_name == 'constant')
		number_of_timesteps = 1
	else
		number_of_timesteps = link_attributes[selected_attribute_name].timesteps.length
		
	if (number_of_timesteps > 1)
		document.getElementById('animation_button').disabled = false;
	else
		document.getElementById('animation_button').disabled = true;
		
	set_current_timestep(0)
	color_links()
	redraw()
}

function color_nodes_by_attribute(attribute, timestep)
{
	vmin = attribute['range'][0]
	vmax = attribute['range'][1]
	
	for (var i in node_colors)
	  node_colors[i] = ''
	  
	timestep_data = attribute.data[timestep]
	
	for (var i in attribute.nodeids)
	{
	  indx = nodemap[attribute.nodeids[i]]		
	  color_features_by_attribute(node_features, nodemap, link_attributes[selected_attribute_name], get_current_timestep())
	  
	  
	  node_colors[i] = val_to_color(timestep_data[i], vmin, vmax);
	}
}

function color_nodes()
{
	selected_attribute_name = document.getElementById('node_color_select').value
	
	if (selected_attribute_name == 'constant') 
		color_features(node_features, "#ff0000")
	else
	{
	    // make sure nodes which do not have the selected attribute
	    // are not rendered
		color_features(node_features, "")
	  	color_features_by_attribute(node_features, nodemap, node_attributes[selected_attribute_name], get_current_timestep())
	}
}

function node_color_selection()
{
	selected_attribute_name = document.getElementById('node_color_select').value;
	
	if (selected_attribute_name == 'constant')
		number_of_timesteps = 1
	else
		number_of_timesteps = node_attributes[selected_attribute_name].timesteps.length
		
	if (number_of_timesteps > 1)
		document.getElementById('animation_button').disabled = false;
	else
		document.getElementById('animation_button').disabled = true;
		
	color_nodes()
	redraw()
}


var once = true;

function redraw()
{
    dataLayer.removeAllFeatures();
	
	features = []
	
	if (document.getElementById("selection_type_nodelink").checked)
	{		
		linkCheckBoxes = document.getElementsByName('linktypes');
		checkedLinkTypes = {}
		for (var i = 0, j = linkCheckBoxes.length; i < j; i++)
			if (linkCheckBoxes[i].checked)
				checkedLinkTypes[linkCheckBoxes[i].value] = 1
		
		nodeCheckBoxes = document.getElementsByName('nodetypes')
		checkedNodeTypes = {}
		for (var i = 0, j = nodeCheckBoxes.length; i < j; i++)
			if (nodeCheckBoxes[i].checked)
				checkedNodeTypes[nodeCheckBoxes[i].value] = 1
	
		display_offset_links = true;
		
		for (var i in offset_link_features)
		{
			f = offset_link_features[i]
			if (f.linkType in checkedLinkTypes)
				features.push(f);
		}
				
		for (var i in node_features)
		{
			n = node_features[i]
			if (n.nodeType in checkedNodeTypes)
				features.push(n)
		}
	}
	else if (document.getElementById("selection_type_busroute").checked)
	{
		busRouteCheckBoxes = document.getElementsByName('busroutes')
		checkedBusRoutes = {}
		for (var i = 0, j = busRouteCheckBoxes.length; i < j; i++)
			if (busRouteCheckBoxes[i].checked)
				checkedBusRoutes[busRouteCheckBoxes[i].value] = 1

		display_offset_links = true;
		
		busRouteCheckBoxes = document.getElementsByName('busroutes');
		for (var i in busRouteCheckBoxes)
			if (busRouteCheckBoxes[i].checked)
			{
				route = busroutes[busRouteCheckBoxes[i].value];
				for (var l in route)
					features.push(offset_link_features[linkmap[route[l]]])
			}
	}
	else
	{	 
		if (path_mode == 0)
		{	
			popdown()
			show_popups(false)
			for (var i in path_origins)
				features.push(node_features[nodemap[path_origins[i]]]);
	    }
	    else if (path_mode == 1)
	    {
			for (var i in path_destinations)
				features.push(node_features[nodemap[path_origins[i]]]);
	    }
	    else
	    {
	    	show_popups(true)
	    	
	    	timestep = path_properties.timesteps[get_current_timestep()]
	    	for (var l in timestep.ids)
	    	{
	    	    lid = linkmap[timestep.ids[l]]
	    	    feature = create_link_feature(lid)
	    	    features.push(feature)

			}    	
  	  	}
	       
	}

	dataLayer.addFeatures(features);
	
	dataLayer.redraw();        
}

function receive_link_data(data)
{
	if (data['status'] != 'OK')
		alert('Data access error: ' + data['status']);
	else
	{
		for (var varname in data.linkdata)
		{
			attribute = data.linkdata[varname]
			attribute_minmax(attribute)
			link_attributes[varname] = attribute
		}		    
		
		post_link_color_options(varname);		
		link_color_selection();

	}
}
	
function load_link_data(filename)
{
	$.ajax({
		url: '/network/load_link_data/' + network_name + '/' + filename,
		dataType : 'json',
		cache: false,
		success: receive_link_data
		});

}

function load_link_data_dialog()
{
    str = '<input type="text" id="loadfile">' + 
          '<input type="button" value="DoIt" onclick=load_link_data($("#loadfile").val());$("#dialog").dialog("close");' +
          '>'
    $( "#dialog" ).html(str) 
    $( "#dialog" ).dialog("open"); 
}

function receive_node_data(data)
{}

function load_node_data()
{}

function receive_path_data(data)
{	
	if (data['status'] != 'OK')
		alert('Data access error: ' + data['status']);
	else
	    path_datasets[data['name']] = data['paths']
	
	post_path_data_options(data['name'])
	redraw()
}

function load_path_data(filename)
{
	$.ajax({
		url: '/network/load_path_data/' + network_name + '/' + filename,
		dataType : 'json',
		cache: false,
		success: receive_path_data
		});
}

function add_path_dataset(dataset)
{
	path_datasets.push(dataset)
	post_path_data_options(dataset)
}


function load_path_data_dialog()
{
    str = '<input type="text" id="loadfile">' + 
          '<input type="button" value="DoIt" onclick=add_path_dataset($("#loadfile").val());$("#dialog").dialog("close");' +
          '>'
    $( "#dialog" ).html(str) 
    $( "#dialog" ).dialog("open"); 
}

function load_path_origins()
{
	$.ajax({
		url: '/network/load_origins/' + network_name + '/' + document.getElementById('path_data_select').value,
		dataType : 'json',
		cache: false,
		success: receive_path_origins
		});
}

function receive_path_origins(data)
{
	if (data['status'] != 'OK')
		alert('Data access error: ' + data['status']);

    path_origins = data['origins']
	redraw()
}

function load_path_destinations()
{
	$.ajax({
		url: '/network/load_destinations/' + network_name + '/' + document.getElementById('path_data_select').value + '/' + path_origin_node,
		dataType : 'json',
		cache: false,
		success: receive_path_destinations
		});
}

function receive_path_destinations(data)
{
	if (data['status'] != 'OK')
		alert('Data access error: ' + data['status']);

    path_destinations = data['destinations']
	redraw()
}

function load_paths(o, d)
{
	$.ajax({
		url: '/network/load_paths/' + network_name + '/' + document.getElementById('path_data_select').value + '/' + path_origin_node + '/100/' + path_destination_node,
		dataType : 'json',
		cache: false,
		success: receive_paths
		});
}

function receive_paths(data)
{
	if (data['status'] != 'OK')
		alert('Data access error: ' + data['status']);

    path_destinations = data['destinations']	    
    set_current_timestep(0)
    color_links()
	redraw()
}

function selection_type()
{
	if (document.getElementById('selection_type_nodelink').checked)
	{
		show_popups(true)
		
		document.getElementById('pathSelect').style.visibility = "hidden";
		document.getElementById('busRouteSelect').style.visibility = "hidden";
		document.getElementById('nodeLinkTypeSelect').style.visibility = "visible";
		
		redraw();
	}
	else if (document.getElementById('selection_type_busroute').checked)
	{
		show_popups(true)
		
		document.getElementById('pathSelect').style.visibility = "hidden";
		document.getElementById('nodeLinkTypeSelect').style.visibility = "hidden";
		document.getElementById('busRouteSelect').style.visibility = "visible";
		
		redraw();
	}
	else
	{		
		show_popups(false)
		path_mode = 0
		
		load_path_origins();
		
		document.getElementById('pathSelect').style.visibility = "visible";
		document.getElementById('nodeLinkTypeSelect').style.visibility = "hidden";
		document.getElementById('busRouteSelect').style.visibility = "hidden";
	}
}

function new_path_selection()
{
	path_mode = 0
	document.getElementById('path_origin').value = ""
	document.getElementById('path_destination').value = ""
	redraw()
}


function Interpolate(start, end, steps, count) 
{
	var s = start;
	var e = end;
	var final = s + (((e - s) / steps) * count);
	return Math.floor(final);
}

function val_to_color(v, min, max)
{
	val = 100.0 * (v - min)/(max - min);
	
	if (val > 50)
	{
		start = [0,255,0];
		end   = [255,0,0];
		val   = val - 50.0;
	}
	else
	{
		start = [0,0,255];
		end   = [0,255,0];
	}
	
	var r = Interpolate(start[0], end[0], 50, val);
	var g = Interpolate(start[1], end[1], 50, val);
	var b = Interpolate(start[2], end[2], 50, val);
	
	if (r < 16) rs = '0' + r.toString(16);
	else rs = r.toString(16);
	
	if (g < 16) gs = '0' + g.toString(16);
	else gs = g.toString(16);
	
	if (b < 16) bs = '0' + b.toString(16);
	else bs = b.toString(16);
	
	return "#" + rs + gs + bs;
}

function toggleMap()
{
	if (osm.getVisibility())
	{
	    document.getElementById('mapToggleButton').value = 'Show Map'
		osm.setVisibility(false);
	}
	else
	{
	    document.getElementById('mapToggleButton').value = 'Hide Map'
		osm.setVisibility(true);
	}
}

