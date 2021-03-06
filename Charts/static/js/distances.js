var routes = [];
var networkInfo =[];
var distances = [];
load_data();

function load_data(){
    $.ajax({
        url : '/charts/loaddistance/' + db + '/' + host + '/' + pwd + '/' + user + '/' + route,
        dataType : 'json',
        cache : false,
        success : receive_data,
        error: function() {
	        alert("Unable to load data, See results.py, views.py, and urls.py");
        }
    });
}

// what's going on here...
function receive_data(json){
    for(var key in json.data){
        routes.push('Route: ' + key);
		distances.push(json.data[key]);
    networkInfo.push(json['networkName']);
    }
    makeColumnChart();
}

function makeColumnChart(){
    $('#container').highcharts({
        chart: {
        type: 'bar'
        },
        title: {
            text: 'Travel Distances'
        },
        subtitle: {
            text: networkInfo[0]
        },
        xAxis: {
            categories: routes
        },
        yAxis: {
            min: 0,
            title: {
                text: 'Distance'
            }
        },
        tooltip: {
            headerFormat: '<span style="font-size:10px">{point.key}</span><table>',
            pointFormat: '<tr><td style="color:{series.color};padding:0">{series.name}: </td>' +
                '<td style="padding:0"><b>{point.y:.1f}miles</b></td></tr>',
            footerFormat: '</table>',
            shared: true,
            useHTML: true
        },
        plotOptions: {
            column: {
                pointPadding: 0.2,
                borderWidth: 0
            }
        },
		series: [{
			name: 'Distance',
			data: distances
		}]
    });
};
