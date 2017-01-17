
jQuery.each( [ "put", "delete" ], function( i, method ) {
  jQuery[ method ] = function( url, data, callback, type ) {
    if ( jQuery.isFunction( data ) ) {
      type = type || callback;
      callback = data;
      data = undefined;
    }

    return jQuery.ajax({

      headers: {
        'Authorization': 'Bearer ' + localStorage.jwt
      },
      url: url,
      type: method,
      dataType: type,
      data: data,
      success: callback
    });
  };
});



var base_url = swAppConfig.urlBase;

var helpers = new function(){
    

    this.getFormData = function($form){
        var unindexed_array = $form.serializeArray();
        var indexed_array = {};

        $.map(unindexed_array, function(n, i){
            indexed_array[n['name']] = n['value'];
        });

        return indexed_array;
    }


    this.getMarkerColor = function(boat_status){
        return case_statuses[boat_status].color;
    };
    
    this.generateMarkerClusterFeatures = function(cases){
        
        var features = []
        var self = this;
        $.each(cases, function(index, value){
            features.push({
                    "type": "Feature",
                    
                    "properties": {
                      "marker-color": "#"+self.getMarkerColor(value.boat_status),
                      'case_id':value.id
                    },
                    "geometry": {
                        "coordinates": [parseFloat(value.locations[0].lon),parseFloat(value.locations[0].lat)],
                        "type": "Point"
                    }
                });
        });
        
        return {
            "type": "FeatureCollection",
            "features": features,
            "id": "markerCluster"
        };
    }
};

var swApp = new function(){
    
    this.startLocation = [33.8,15];
    this.mapContainerId = 'maps';
    this.mapLayers = [];
    
    this.involvedCases = []; //list of ids
    this.cases = {} //case objects which also contain the map objects
    this.vehicles = {} //case objects which also contain the map objects
    this.lastUpdated = 0;
    
    this.map;

    this.maptype = 'mapbox';
    
    //general init
    this.init = function(){

        this.initReload();
        
        //preload audio file
        $("#bing").trigger('load');

        $('#createCaseForm').submit(function(e){
            e.preventDefault();
            var data = $('#createCaseForm').serializeArray();
            //data.push({name: 'wordlist', value: wordlist});
            var postData = {};
            $(data ).each(function(index, obj){
                postData[obj.name] = obj.value;
            });
            
            
            postData.location_data = JSON.stringify({latitude:postData.lat, longitude:postData.lon, heading:0, accuracy: 0});
            $.post(base_url+"cases/create", postData, function(result){
                var result = JSON.parse(result);
                if(result.error == null){
                    alert('case created');
                    chat_messages.push({id:3,author:{username:'SW2',vehicle_id:2},type:'log',text:'added Case <a>#'+ result.data.emergency_case_id+'</a>. Status: '+postData.boat_status+', Type:  '+postData.boat_type+', Condition:  '+postData.boat_condition+'',created_at:String(new Date())});
                    $('#createCaseBox').slideUp();
                }else{
                    alert(result.error);
                }
            });
        });
        
        $('.caseBox').show();
                    
        //filter for casenav
        $('.filter').click(function(e){
            e.preventDefault();
            if($(this).hasClass('all')){
                if($(this).hasClass('active')){
                    $(this).removeClass('active');
                }else{
                    $(this).addClass('active');
                }
                $('.filter').not(this).not('.all').removeClass('active');
            }else{
                $(this).prevAll('.all').first().removeClass('active');
                if($(this).hasClass('active')){
                    $(this).removeClass('active');
                }else{
                    $(this).addClass('active');
                }
            }
            
            $('.caseBox').show();
            $('.caseBox').hide();
            var results = [];
            $('.filter.active').each(function(){
                results.push($(this).attr('data-class'));
                if($(this).attr('data-class')){
                        $('.'+$(this).attr('data-class')).show();
                }
            });
            if(results.join('') === '')
                        $('.caseBox').show();
                    
            
                
        });
    };
    
    //used to init map in views/pages/home_map
    this.initMap = function(){
        this.map = L.mapbox.map(this.mapContainerId, '')
        //this.map = L.mapbox.map(this.mapContainerId, '')
        this.map.options.maxZoom = 10;
        this.map.options.minZoom = 7;
        this.map.setView(this.startLocation, 7);
        this.applyFilters();


        var self = this;


        switch(this.maptype){
            case'offline-map':

                L.tileLayer('MapQuest/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://sea-watch.org">Sea-Watch</a>'
                }).addTo(this.map);
           
            break;
            
            case'geojson':

                $.getJSON("./mapdata/geojson/countries.geo.json", function(data){
                    console.log("Got persistent geo data from server");

                    //localStorage.setItem("persitentgeodata", JSON.stringify(data));
                    //L.geoJson(data).addTo(map);
                    L.geoJson(data).addTo(self.map);
                });

            break;
            
            case'mapbox':


                L.tileLayer('https://api.mapbox.com/styles/v1/joshua-seawatch/ciwe2hqkr003v2qmvis5br8v9/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1Ijoiam9zaHVhLXNlYXdhdGNoIiwiYSI6ImNpamxicDZxOTAwMXZ1eWx4OWpnNmIwOGgifQ.KZmezOnFeVvEptY6FKBndw', {
                    attribution: '&copy; <a href="https://sea-watch.org">Sea-Watch</a>'
                }).addTo(this.map);
            break;

        }

        
        this.init();
        
        $('.filter').click(function(){
            //500ms delay otherwise class is not added before filters are applied
            setTimeout(function() {
                self.applyFilters();
                self.initClicks();
            },500);
        });
    };
    
    
    //old - not used?
    this.addVesselsToMap = function(){
            var self = this;
            $.get(base_url+'getVehicles',{request: 'request'} ,function( result ) {
                console.log('vessels:');
                console.log('vessels:');
                console.log('vessels:');
                console.log(result);
                $.each(result.vessels, function(index,value){
                    
                        L.mapbox.featureLayer({
                            // this feature is in the GeoJSON format: see geojson.org
                            // for the full specification
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                // coordinates here are in longitude, latitude order because
                                // x, y is the standard for GeoJSON and many formats
                                coordinates: [
                                  
                                  value.locations[0].lon,
                                  value.locations[0].lat
                                ]
                            },
                            properties: {
                                title: 'Peregrine Espresso',
                                description: '1718 14th St NW, Washington, DC',
                                // one can customize markers by adding simplestyle properties
                                // https://www.mapbox.com/guides/an-open-platform/#simplestyle
                                'marker-size': 'large',
                                'marker-color': '#121212'
                            }
                        }).on('click', function(e) {
                            console.log(e.layer.feature.properties);
                            //this.setGeoJSON(geoJson);?
                        }).addTo(self.map);
                    
                    
                });
                
            });
    };
    
    this.addMarkerToMap = function(location, color){
        
        L.mapbox.featureLayer({
            // this feature is in the GeoJSON format: see geojson.org
            // for the full specification
            type: 'Feature',
            geometry: {
                type: 'Point',
                // coordinates here are in longitude, latitude order because
                // x, y is the standard for GeoJSON and many formats
                coordinates: [
                  location[1],
                  location[0] 
                ]
            },
            properties: {
                title: 'Peregrine Espresso',
                description: '1718 14th St NW, Washington, DC',
                // one can customize markers by adding simplestyle properties
                // https://www.mapbox.com/guides/an-open-platform/#simplestyle
                'marker-size': 'large',
                'marker-color': '#'+color,
                'marker-symbol': 'cafe'
            }
        }).on('click', function(e) {
            console.log('test');
            console.log(e.layer.feature.properties);
            //this.setGeoJSON(geoJson);?
        }).addTo(this.map);
        
    };
    this.getFilters = function(){
        var filters = {};
        filters.operation_areas = [];
        $('.op_area.active').each(function(){
            if(typeof $(this).attr('data-id') !== 'undefined')
                filters.operation_areas.push($(this).attr('data-id'));
        });

        filters.statuses = [];
        $('.status.active').each(function(){
            if(typeof $(this).attr('data-class') !== 'undefined')
                filters.statuses.push($(this).attr('data-class'));
        });

        filters.sources = [];
        $('.source.active').each(function(){
            if(typeof $(this).attr('data-class') !== 'undefined')
                filters.sources.push($(this).attr('data-class'));
        });
        
        filters.vehicles = [];
        $('li.vehicle.active').each(function(){
            filters.vehicles.push({id:$(this).attr('data-id')});
        });
        return filters;
    };
    this.filterCases = function(cases){
        var filters = this.getFilters();
        
            
            //all filters deactivated
            if(filters.operation_areas.length === 0 &&
               filters.statuses.length === 0 &&
               filters.sources.length === 0){
                    filtered_cases = cases;
            }else{
                if(filters.operation_areas.length > 0){
                    var filtered_cases = [];
                    $.each(cases,function(index,caseObj){
                        
                        if(filters.operation_areas.contains(caseObj.operation_area)){
                            filtered_cases.push(caseObj);
                        }
                    });
                    var cases = filtered_cases;
                    
                }
                if(filters.statuses.length > 0){
                    var filtered_cases = [];
                    $.each(cases,function(index,caseObj){
                        
                        if(filters.statuses.contains(caseObj.boat_status)){
                            filtered_cases.push(caseObj);
                        }
                    });
                    var cases = filtered_cases;
                    
                }
                
                
            }
        return filtered_cases;
        
    };
    
    
    
    this.pushChatMessage = function(case_id, options){
            var divClass, pClass;
            pClass = '';
          if(options.type === 'sent'){
              divClass = "user_2 message";
          }
          if(options.type === 'received'){
              divClass = "user_1 message";
          }
          if(options.type === 'notification'){
              divClass = "chat_status_notification";
              pClass = 'meta';
          }
          
          
     
          //check if message is base64 image
          //@sec base64 xss possible?: https://www.owasp.org/index.php/XSS_Filter_Evasion_Cheat_Sheet
           var matches = options.message.match(/III(.+?)III/g);
          if(matches != null){
              options.message = '<img class="chatImage" src="data:image/jpeg;base64,'+matches[0].replace(/III/g,'').replace('"','\"')+'">';
          }
    
          
          if(typeof $('.caseBox[data-id='+case_id+'] .messenger__chat').attr('data-last-message-received') == 'undefined'&&
             typeof options.message_id !== 'undefined'){
              $('.caseBox[data-id='+case_id+'] .messenger__chat').attr('data-last-message-received', options.message_id);
          }else if(typeof $('.caseBox[data-id='+case_id+'] .messenger__chat').attr('data-last-message-received') !== 'undefined'){
              if(parseInt(options.message_id) > parseInt( $('.caseBox[data-id='+case_id+'] .messenger__chat').attr('data-last-message-received'))){
                $('.caseBox[data-id='+case_id+'] .messenger__chat').attr('data-last-message-received', options.message_id);
              }
          }
          
          var html = '<div class="'+divClass+'" data-id="'+options.message_id+'">'
              html += '    <p class="'+pClass+'">'+options.message+'</p>';
              html += '</div>';
              
          if($('.message[data-id='+options.message_id+']').length === 0)
            $('.caseBox[data-id='+case_id+'] .messenger__chat').append(html);
        };
    //handles array of messages and pushes them into the chat
    this.handleMessageArray = function(messageArray){
            var self = this;
            $.each(messageArray,function(index, value){
                var type = 'sent';
                if(value.sender_type === 'refugee'){
                    type = 'received';
                }
                self.pushChatMessage(value.emergency_case_id, {type:type, message:value.message, message_id:value.id});
            });
        };
    this.updateOnlineStatus = function(reloadtime){
        $('#online_status').removeClass('online');
        $('#online_status').removeClass('offline');
        $('#online_status').removeClass('medium');
        
        switch(reloadtime){
            default:
                $('#online_status').addClass('online');
                break;
            case 0:
                $('#online_status').addClass('offline');
                break;
            case reloadtime>15:
                $('#online_status').addClass('medium');
                break;
                
        }
    }
    this.initReload = function(){
        var self = this;
        setInterval(function() {
            self.reload();
        }, 10000);
    }
    this.reload = function(){
            var self = this;
            var request = {};
            request.last_updated = this.lastUpdated;
            
            request.cases = [];
            $.each(this.involvedCases, function(index, value){
                
                request.cases.push({id:value, last_message_received:parseInt($('.caseBox[data-id='+value+'] .messenger__chat').attr('data-last-message-received'))});
                
            });
            
            
            var tbefore = Date.now();
            $.post(base_url+'reloadBackend',{request: request} ,function( result ) {
                console.log('updateonlinestatus');
                self.updateOnlineStatus(Date.now()-tbefore);
                self.lastUpdated = Math.round(new Date().getTime()/1000);
                
                
                
                    if(result == 'null')
                        return 0;
                    
                    if(typeof result.data.cases !== 'undefined'){
                        $.each(result.data.cases, function(index, value){
                            emergency_cases_obj.push(value);
                            self.reloadCase(value.id);
                        });
                    }
                    
                    if(typeof result.data.vehicles !== 'undefined'){
                        
                        $.each(result.data.vehicles, function(index, vehicleObj){
                            if(swApp.getVehicleData(vehicleObj.id) == null){
                                vehicles_obj.push(vehicleObj);
                            }
                            swApp.addVehicleToMap(swApp.map,  null, vehicleObj);

                        });
                    }
                    
                    if(typeof result.data.messages !== 'undefined')
                        $.each(result.data.messages, function(index, value){
                            var case_id = index;
                            self.handleMessageArray(value);
                        });
                    setTimeout(function(){
                        $('#loadingOverlay').slideUp(function(){
                            $(this).remove();
                        });
                    }, 3000);
                    swApp.applyFilters();
                    swApp.initClicks();
            }).fail(function() {
                self.updateOnlineStatus(0);
            });
    };
        
    //reloads casebox if casebox exists otherwise creates new casebox
    this.reloadCase = function(case_id){
        console.log('reloadCase');
        
        var self = this;
        if(typeof this.map === 'object'){
            //map mode
            //
            //play sound
            self.bing();
            
            //add caseToMap
            self.addCaseToMap(self.map, case_id);
            
        }else{
            //grid mode
            if($('.caseBox_'+case_id).length > 0){
                //update caseBox
                
                //update polyline and marker
                self.addCaseToMap(self.cases[case_id].map, case_id);
                self.initClicks();
                
            }else{
                    self.showCaseBox(case_id);

                    //play sound
                    self.bing();
                    $('#caseList').prepend(result);
                    self.initClicks();
                    
                    
                    $('.caseBox').css('position', 'relative');
                    
            }
        }
        
    };
    this.initClicks = function(){
        var self = this;


        $('.use_location').click(function(){
            var vehicle_data = self.getVehicleData(localStorage.vehicleid);
            $('#createCaseForm #lat').val(vehicle_data.locations[0].lat);
            $('#createCaseForm #lon').val(vehicle_data.locations[0].lon);
        });

        $('.get-involved').click(function(e){
            e.preventDefault();
            var case_id = $(this).attr('data-id');
            emergency_case.getInvolved(case_id,function(result){

                if(result.error != null){
                    alert(result.error);
                }else{

                    self.handleMessageArray(result.data.messages);

                    $('.caseBox_'+case_id+' .front').hide();
                    $('.caseBox_'+case_id+' .back').show();

                    $('.caseBox_'+case_id+' .close_chat').click(function(){
                        $('.caseBox_'+case_id+' .front').show();
                        $('.caseBox_'+case_id+' .back').hide();
                    });

                }
            });
        });
        $('.show-messages').click(function(e){
            e.preventDefault();
            var case_id = $(this).attr('data-id');
            emergency_case.showChat(case_id,function(result){

                if(result.error != null){
                    alert(result.error);
                }else{

                    self.handleMessageArray(result.data.messages);

                    $('.caseBox_'+case_id+' .front').hide();
                    $('.caseBox_'+case_id+' .back').show();

                    $('.caseBox_'+case_id+' .close_chat').click(function(){
                        $('.caseBox_'+case_id+' .front').show();
                        $('.caseBox_'+case_id+' .back').hide();
                    });

                }
            });
        });

        $('.caseBox .form_inline form').submit(function(e){
            e.preventDefault();
            var case_id = $(this).find('input[type=text]').attr('data-id');
            var message = $(this).find('input[type=text]').val();
            var $this = $(this).find('input[type=text]');

            emergency_case.submitMessage(case_id, message,function(){
                $this.val('');
            });

        });

        $('.caseBox .case_settings').click(function(e){
            e.preventDefault();
            var $this = $(this);

            var case_id = $(this).parent().parent().parent().attr('data-id');

            $(this).parent().parent().parent().children('.editCase').load('cases/edit/'+case_id,function(){ 

                $this.parent().parent().parent().children('.front,.back').hide();
                $(this).show();

                var $front = $this.parent().parent().parent().children('.front');
                var $editCase = $(this);

                $(this).children('form').submit(function(e){
                    e.preventDefault();

                    var data = $(this).serialize();

                    $.ajax({
                        type: "POST",
                        url: "cases/edit/"+case_id,
                        data: data,
                        dataType: "json",
                        statusCode: {
                            200: function(data) {
                                if(data === 1){
                                    alert('the case has been updated');
                                    $editCase.hide();
                                    $front.show();
                                }
                            }
                        }
                    });
                });

                $('.closeEditCase').click(function(){
                    $(this).parent().parent().parent().parent().children('.editCase').hide();
                    $(this).parent().parent().parent().parent().children('.front').show();
                });
            });


        });
    };
    this.updateCase = function(case_id){
        var $form = $("#update_case_"+case_id);
        var data = this.getFormData($form);
        var self = this;
        data._token = 'ddpELHPSgdijORBQPCaIb0b0WhVDsqRaiNQ8tIso';

        $.put(base_url+'case/'+case_id, data, function(result){
           alert('The case has been updated');
           $('#caseDetailContainer').hide();
           $('.caseBox .front').show();
           $('.caseBox .edit').hide();
        });
    }
    this.showCaseBox = function(case_id){
        var caseData = this.getCaseData(case_id);
        var html="";
html += "<div class=\"caseBox confirmed_target  type_create_case_form oparea_1 caseBox_214\" data-id=\""+case_id+"\">";
html += "                    <div class=\"front\">";
html += "                            <header style=\"clear:left;height:40px\">";
html += "                                <span class=\"time\">2016-09-25 22:29:02<\/span>";
html += "                                 <span class=\"connection_type\">";
html += "                                <\/span>";
html += "                                <div class=\"status\">";
html += "<span class=\"id\" style=\"font-size:15px\">Case #"+case_id+"<\/span>";
html +=                                        caseData.boat_status;
html += "                                <\/div>";
html += "                                <div class=\"case_settings\">";
html += "<a href=\"#\"><i class=\"zmdi zmdi-settings\"><\/i><\/a>";
html += "                                <\/div>";
html += "                            <\/header>";
html += "                            <div class=\"content\">";
html += "                                <table class=\"table\">";
html += "                                                                            <tbody><tr>";
html += "                                            <td>ID<\/td>";
html += "                                            <td>"+case_id+"<\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>Closing Reason<\/td>";
html += "                                            <td><\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>status<\/td>";
html += "                                            <td>"+caseData.boat_status+"<\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>Condition<\/td>";
html += "                                            <td>"+caseData.boat_condition+"<\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>Type<\/td>";
html += "                                            <td>"+caseData.boat_type+"<\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>engine working<\/td>";
html += "                                            <td>"+caseData.engine_working+"<\/td>";
html += "                                        <\/tr>";
html += "                                        <tr>";
html += "                                            <td>others involved<\/td>";
html += "                                            <td>"+caseData.other_involved+"<\/td>";
html += "                                        <\/tr>";
html += "                                        <tr>";
html += "                                            <td>Passenger count<\/td>";
html += "                                            <td>"+caseData.passenger_count+"<\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>...Women<\/td>";
html += "                                            <td>"+caseData.women_on_board+"<\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>...Children<\/td>";
html += "                                            <td>"+caseData.children_on_board+"<\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>...Disabled<\/td>";
html += "                                            <td>"+caseData.disabled_on_board+"<\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>Additional infos<\/td>";
html += "                                            <td>"+caseData.additional_informations+"<\/td>";
html += "                                        <\/tr>";
html += "                                <\/tbody><\/table>";
html += "                            <\/div>";
html += "                    <\/div>";
html += "                            <div class=\"edit\">";
html += "                                <a href=\"#\" data-id=\""+case_id+"\" class=\"btn btn-sm pull-right case_settings\">back<\/a>";
html += "                                <form id=\"update_case_"+case_id+"\">";
html += "                                <table class=\"table\">";
html += "                                                                            <tbody><tr>";
html += "                                            <td>ID<\/td>";
html += "                                            <td>"+case_id+"<\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>Closing Reason<\/td>";
html += "                                            <td><\/td>";
html += "                                        <tr>";
html += "                                           <td>status<\/td>";
html += "                                           <td><select class=\"form-control\" name=\"boat_status\" id=\"boat_status\" ng-model=\"case.boat_status\">";
html += "                                               <option value=\""+caseData.boat_status+"\">"+caseData.boat_status+"<\/option>";
html += "                                               <option value=\"need_help\">Need Help<\/option>";
html += "                                               <option value=\"critical_target\">Critical<\/option>";
html += "                                               <option value=\"rescued\">Rescued<\/option>";
html += "                                               <option value=\"confirmed_target\">Confirmed Target<\/option>";
html += "                                               <option value=\"possible_target\">Possible Target<\/option>";
html += "                                               <option value=\"attended\">Attended<\/option>";
html += "                                               <option value=\"closed\">Closed<\/option>";
html += "                                           <\/select></td>";
html += "                                        <\/tr>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>Condition<\/td>";
html += "                                            <td><select class=\"form-control\" name=\"boat_condition\" id=\"boat_condition\">";
html += "                                                   <option value=\""+caseData.boat_condition+"\">"+caseData.boat_condition+"<\/option>";
html += "                                                   <option value=\"unknown\">Unknown<\/option>";
html += "                                                   <option value=\"good\">Good<\/option>";
html += "                                                   <option value=\"bad\">Bad<\/option>";
html += "                                                   <option value=\"sinking\">Sinking<\/option>";
html += "                                                   <option value=\"people_in_water\">People in water<\/option>";
html += "                                               <\/select></td>";

html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>Type<\/td>";
html += "                                            <td>";
html += "                                               <select class=\"form-control\" name=\"boat_type\" id=\"boat_type\" ng-model=\"case.boat_type\">";
html += "                                                   <option value=\""+caseData.boat_type+"\">"+caseData.boat_type+"<\/option>";
html += "                                                   <option value=\"rubber\">Rubber<\/option>";
html += "                                                   <option value=\"wood\">Wood<\/option>";
html += "                                                   <option value=\"steel\">Steel<\/option>";
html += "                                                   <option value=\"other\">Other<\/option>";
html += "                                                <\/select></td>";

html += "                                        <\/tr>";
html += "                                        <tr>";
html += "                                            <td>engine working<\/td>";
var checked  = '';
if(caseData.engine_working === '1')
    checked = 'checked';

html += "                                            <td><input type=\"checkbox\" name=\"engine_working\" value\"1\" "+checked+"><\/td>";
html += "                                        <\/tr>";
html += "                                        <tr>";
html += "                                            <td>other organisations involved<\/td>";
var checked  = '';
if(caseData.other_involved === '1')
    checked = 'checked';

html += "                                            <td><input type=\"checkbox\" name=\"other_involved\"  value\"1\" "+checked+"><\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>Passenger count<\/td>";
html += "                                            <td><input type=\"number\"  name=\"passenger_count\" value=\""+caseData.passenger_count+"\"><\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>...Women<\/td>";

html += "                                            <td><input type=\"number\"  name=\"women_on_board\" value=\""+caseData.women_on_board+"\"><\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>...Children<\/td>";

html += "                                            <td><input type=\"number\"  name=\"children_on_board\"  value=\""+caseData.children_on_board+"\"><\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>...Disabled<\/td>";
html += "                                            <td><input type=\"number\"  name=\"disabled_on_board\"  value=\""+caseData.disabled_on_board+"\"><\/td>";
html += "                                        <\/tr>";
html += "                                                                                <tr>";
html += "                                            <td>Additional infos<\/td>";
html += "                                            <td><input type=\"text\"  name=\"additional_informations\"  value=\""+caseData.additional_informations+"\"><\/td>";
html += "                                        <\/tr>";
html += "                                        <tr>";
html += "                                            <td><\/td>";
html += "                                            <td><a onclick=\"swApp.updateCase("+case_id+")\">update case</a><\/td>";
html += "                                        <\/tr>";
html += "                                <\/tbody><\/table></form>";
html += "                            <\/div>";
html += "                    <\/div>";
html += "                    <div class=\"back\" style=\"display:none\">";
html += "                        <header>";
html += "";
html += "                                <span class=\"time\">5 days ago<\/span>";
html += "                                <span class=\"connection_type\">";
html += "                                <\/span>";
html += "";
html += "                                <span class=\"status\">";
html += "                                    Confirmed";
html += "                                <\/span>";
html += "                                <span class=\"source\">Refugee<\/span>";
html += "                            <\/header>";
html += "                            <div class=\"content messenger\">";
html += "                                       <div class=\"messenger__chat container__large\">";
html += "                                            <!--<div class=\"user_1 message\">";
html += "                                                <p>Hi, here is Sea-Watch!";
html += "                                                Wir suchen nun ein Rettungsteam. Bitte bleibe ruhig und schließe diese App nicht. Kannst du uns sagen wie viele Leute ihr auf dem Boot seid und wie eure Lage aktuell ist.<\/p>";
html += "                                            <\/div>";
html += "                                             <div class=\"user_2 message\"> ";
html += "                                                <p>we need help, please rescue, we are 40 people in small boat, children, womans <\/p>";
html += "                                            <\/div>";
html += "                                            <div class=\"chat_status_notification\">";
html += "                                                <p class=\"meta\">Your internet is slow. The App now use \"SMS-MODE\".<\/p>";
html += "                                            <\/div>";
html += "";
html += "                                            <div class=\"user_2 message sms_mode\">";
html += "                                               <p class=\"lonlat\">LON: <span class=\"lon\">15.92828<\/span> · LAT: <span class=\"lat\">17.34454<\/span><\/p>";
html += "                                               <p>Hi, please help! we are sinking.<\/p>";
html += "                                            <\/div>-->";
html += "                                        <\/div>";
html += "                                        <div class=\"messenger__form\">";
html += "                                            <a class=\"close_chat\" href=\"#\"><i class=\"zmdi zmdi-arrow-left\"><\/i><\/a>";
html += "                                            <div class=\"form_inline\">";
html += "                                                <form>";
html += "                                                    <input type=\"text\" aria-label=\"Schreibe einen Text…\" data-id=\"214\">";
html += "                                                    <button type=\"button\">Senden<\/button>";
html += "                                                <\/form>";
html += "                                            <\/div>";
html += "                                        <\/div>";
html += "                            <\/div>";
html += "                    <\/div>";
html += "                    <div class=\"editCase content\" style=\"display:none; padding:0 30px;\">";
html += "                    <\/div>";
html += "                <\/div>";

                    $('#caseDetailContainer').show();
                    $('#caseDetailContainer').html(html);

                    $('.caseBox .case_settings').click(function(){
                        $('.caseBox .front').toggle();
                        $('.caseBox .edit').toggle();
                    });

    };
    this.loadCaseBox = function(case_id, callback){
        $.post(base_url+'loadCaseBox',{request: {case_id:case_id}} ,function( result ) {
            callback(result);
        });
    };
    
    this.showCaseDetails = function(case_id){
        this.clearMap;
        var caseObj = this.getCaseData(case_id);
        alert('showing now details for location');
        var self = this
        
        $.each(caseObj.locations, function(index,value){
            self.addMarkerToMap(helpers.getMarkerColor(caseObj.boat_status),[parseFloat(value.lat),parseFloat(value.lon)]);
        });
        
        
    };
    this.getCaseData = function(id){
        var ret = null;
        $.each(emergency_cases_obj,function(index, value){
            if(parseInt(value.id) == parseInt(id)){
                ret = value;
            }
        });
        return ret;
    };
    this.getVehicleData = function(id){
        var ret = null;
        $.each(vehicles_obj,function(index, value){
            if(parseInt(value.id) == parseInt(id)){
                ret = value;
            }
        });
        return ret;
    };
    this.clusterLayer;
    
    
    
    
    this.applyFilters = function(){
        
        //clear map
        this.clearMap();
        
        //add cases from object in home_map.blade.php
        $.each(this.filterCases(emergency_cases_obj), function(index,value){
            swApp.addCaseToMap(swApp.map, value.id);
        });
        
        //add vehicles from object in home_map.blade.php
        
        $.each(vehicles_obj, function(index,value){
            swApp.addVehicleToMap(swApp.map,  value.id);
        })

        this.showOperationAreas();
        
        
        //this.generateMarkerCluster(this.filterResults(emergency_cases_obj));
    };
    
    this.addCaseToMap = function(map,case_id,suffix){
        
        if(typeof suffix === 'undefined')
            var suffix = '';
        
        var showAll = false;
        
        var self = this;
        
        var real_case_id = case_id;
        var case_id = case_id+suffix;
        
        if(typeof this.cases[case_id] == 'undefined')
            this.cases[case_id] = {};
        else{
            var mapObj;
            if(typeof this.map === 'object')
                mapObj = this.map
            else
                mapObj = this.cases[case_id].map;
           
            if(typeof this.cases[case_id].featureGroup !== 'undefined'&&typeof this.cases[case_id].iconLayer !== 'undefined'){
                mapObj.removeLayer(this.cases[case_id].featureGroup);
                mapObj.removeLayer(this.cases[case_id].iconLayer);
            }
        }
        
        var case_data = this.getCaseData(real_case_id);
        
        
        this.cases[case_id].featureGroup = L.featureGroup().addTo(map);
        var line_points = [];
        $.each(case_data.locations, function(index,value){
            
            if(!showAll&&(index > case_data.locations.length-15))
                line_points.push([parseFloat(value.lat), parseFloat(value.lon)]);
        });

        // Define polyline options
        // http://leafletjs.com/reference.html#polyline
        var polyline_options = {
            color: '#000'
        };

        // Defining a polygon here instead of a polyline will connect the
        // endpoints and fill the path.
        // http://leafletjs.com/reference.html#polygon
        this.cases[case_id].polyline = L.polyline(line_points, polyline_options).addTo(this.cases[case_id].featureGroup);
        //this.mapLayers.push(polyline);
        var currentIndex = this.mapLayers.length;
        this.cases[case_id].iconLayer = L.mapbox.featureLayer().addTo(map);
        this.cases[case_id].iconLayer.on('click',function(e){
            
                self.showCaseBox(real_case_id);

        });
        
        this.mapLayers.push(this.cases[case_id].iconLayer);
        
        if(typeof line_points[0] !== 'undefined'){
            var geoJson = [{
                                type: 'Feature',
                                geometry: {
                                    type: 'Point',
                                    coordinates: [line_points[0][1], line_points[0][0]]
                                },
                                properties: {
                                    title: 'Case-ID:'+real_case_id,
                                    'case-id':real_case_id,
                                    description: 'first tracked: '+case_data.created_at+'<br>last tracked: '+case_data.updated_at,
                                    'marker-color': '#'+helpers.getMarkerColor(case_data.boat_status)
                                }
                            }];

             this.cases[case_id].iconLayer.setGeoJSON(geoJson);
        };
        
    };
    
    this.addVehicleToMap = function(map,vehicle_id, vehicle_data){
        
        var self = this;
        
        if(vehicle_id !== null)
        var vehicle_data = this.getVehicleData(vehicle_id);
        

        //apply filters
        var filters = this.getFilters()

        //all filters are looped and if
        //the filter is in the filter.vehicles
        //array. if not => return null
        var proceed = false;

        //only filter if at least one filter is in the array
        if(filters.vehicles.length > 0){
            $.each(filters.vehicles,function(index, value){
                if(parseInt(value.id) === parseInt(vehicle_id)){
                    proceed = true;
                }
            });
        }else{
            proceed = true;
        }
        
        if(!proceed){
            return null;
        }

        if(typeof this.vehicles[vehicle_id] == 'undefined')
            this.vehicles[vehicle_id] = {};
        else{
            var mapObj;
            if(typeof this.map === 'object')
                mapObj = this.map
            else
                mapObj = this.vehicles[vehicle_id].map;
           
            if(typeof this.vehicles[vehicle_id].featureGroup !== 'undefined'&&typeof this.vehicles[vehicle_id].iconLayer !== 'undefined'){
                mapObj.removeLayer(this.vehicles[vehicle_id].featureGroup);
                mapObj.removeLayer(this.vehicles[vehicle_id].iconLayer);
            }
        }
        
        this.vehicles[vehicle_id].featureGroup = L.featureGroup().addTo(map);
        var line_points = [];
        
        $.each(vehicle_data.locations, function(index,value){

            //only show first 
            if(index < vehicle_data.locations.length){
                line_points.push([parseFloat(value.lat), parseFloat(value.lon)]);
            }
        });
        // Define polyline options
        // http://leafletjs.com/reference.html#polyline
        var polyline_options = {
            color: '#'+vehicle_data.marker_color
        };

        // Defining a polygon here instead of a polyline will connect the
        // endpoints and fill the path.
        // http://leafletjs.com/reference.html#polygon
        this.vehicles[vehicle_id].polyline = L.polyline(line_points, polyline_options).addTo(this.vehicles[vehicle_id].featureGroup);
        //this.mapLayers.push(polyline);
        var currentIndex = this.mapLayers.length;
        this.vehicles[vehicle_id].iconLayer = L.mapbox.featureLayer().addTo(map);
        this.vehicles[vehicle_id].iconLayer.on('click',function(e){
            
                //load vehicleBox
                self.showCaseBox(vehicle_id,function(result){
                    
                    //play sound
                    $('#caseDetailContainer').html(result);
                    self.initClicks();
                });
        });
        
        this.mapLayers.push(this.vehicles[vehicle_id].iconLayer);
        if(typeof line_points[0] !== 'undefined'){
            var geoJson = [{
                                type: 'Feature',
                                geometry: {
                                    type: 'Point',
                                    coordinates: [line_points[0][1], line_points[0][0]]
                                },
                                properties: {
                                    title: 'Vehicle-ID:'+vehicle_id,
                                    'vehicle-id':vehicle_id,
                                    description: 'first tracked: '+vehicle_data.created_at+'<br>last tracked: '+vehicle_data.updated_at,
                                    'marker-color': '#'+vehicle_data.marker_color
                                }
                            }];

            this.vehicles[vehicle_id].iconLayer.setGeoJSON(geoJson);
        };
    };
    
    this.generateMarkerCluster = function(cases){
        
        
        this.clearMap();
        
        
        this.clusterLayer = new L.MarkerClusterGroup().on('click', function(e) {
            swApp.showCaseDetails(e.layer.feature.properties.case_id);
            
            
            //this.setGeoJSON(geoJson);?
        });
        var geoJsonLayer = L.geoJson(helpers.generateMarkerClusterFeatures(cases),{
        
            pointToLayer: L.mapbox.marker.style,
            style: function(feature) { return feature.properties; }
        });

        this.clusterLayer.addLayer(geoJsonLayer);
        this.map.addLayer(this.clusterLayer);
        
    };
    
    this.clearMap = function(){
        if(swApp.clusterLayer)
            swApp.map.removeLayer(swApp.clusterLayer);
        
        
        $.each(this.cases,function(i,v){
            swApp.map.removeLayer(v.polyline);
        });
        $.each(this.vehicles,function(i,v){
            swApp.map.removeLayer(v.polyline);
        });
        
        $.each(this.mapLayers,function(index,value){
            
            swApp.map.removeLayer(value);
        });
    };
    this.getOperationAreaData = function(operation_area_id){
        var result = false;
        $.each(operation_areas_obj, function(index, value){
            if(parseInt(value.id) == parseInt(operation_area_id)){
                result = value;
            }
        });
        return result;
    };
    this.addOperationAreaPolygonToMap = function(operation_area_id){
        var operation_area_data = this.getOperationAreaData(operation_area_id);

                this.mapLayers.push(L.geoJson({
                    'type': 'Feature',
                    'properties': {
                        'name': operation_area_data.title
                    },
                    'geometry': {
                        'type': 'Polygon',
                        'coordinates': [JSON.parse(operation_area_data.polygon_coordinates)]
                    }
                }).addTo(this.map));
            /*this.map.addLayer({
                'id': 'route',
                'type': 'fill',
                'data': {
                    'type': 'Feature',
                    'properties': {
                        'name': operation_area_data.title
                    },
                    'geometry': {
                        'type': 'Polygon',
                        'coordinates': JSON.parse(operation_area_data.polygon_coordinates)
                    }
                },
                'layout': {},
                'paint': {
                    'fill-color': '#088',
                    'fill-opacity': 0.8
                }
            });*/
    };
    this.showOperationAreas = function(){
        var filters = swApp.getFilters();
        var self = this;

//        if(filters.operation_areas.length === 0)
//            $.each(operation_areas_obj, function(index, value){
//                self.addOperationAreaPolygonToMap(value.id);
//            });
//        else
//            $.each(operation_areas_obj,function(index, value){
//                self.addOperationAreaPolygonToMap(value);
//            });
    };
    this.bing = function(){
        
           $("#bing").trigger('play');
    };
};




Array.prototype.contains = function(obj) {
    var i = this.length;
    while (i--) {
        if (this[i] === obj) {
            return true;
        }
    }
    return false;
}

//thx to Darin Dimitrov @ http://stackoverflow.com/questions/1988349/array-push-if-does-not-exist
// check if an element exists in array using a comparer function
// comparer : function(currentElement)
Array.prototype.inArray = function(comparer) { 
    for(var i=0; i < this.length; i++) { 
        if(comparer(this[i])) return true; 
    }
    return false; 
}; 

// adds an element to the array if it does not already exist using a comparer 
// function
Array.prototype.pushIfNotExist = function(element, comparer) { 
    if (!this.inArray(comparer)) {
        this.push(element);
    }
};

function timeSince(date) {

    var seconds = Math.floor((new Date() - date) / 1000);

    var interval = Math.floor(seconds / 31536000);

    if (interval > 1) {
        return interval + " years ago";
    }
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) {
        return interval + " months ago ";
    }
    interval = Math.floor(seconds / 86400);
    if (interval > 1) {
        return interval + " days ago";
    }
    interval = Math.floor(seconds / 3600);
    if (interval > 1) {
        return interval + " hours ago";
    }
    interval = Math.floor(seconds / 60);
    if (interval > 1) {
        return interval + " minutes ago";
    }
    return Math.floor(seconds) + " seconds ago";
}