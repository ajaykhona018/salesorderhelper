var app = angular.module('salesOrderApp', []);

app.controller("saleOrderAppCtrl", function ($scope, $http) {
    $('.modal').modal();
    $scope.hdrLoader = true;
    $scope.lineLoader = false;

    $scope.currentOrder = {
        ORDER_ID: 'NEXT',
        DATE: Date.now(),
        COMPANY: '',
        UPDATE_MODE: false,
        DATA: [

        ]
    }
    $scope.orders = [

    ];

    $scope.addSuggestionData = {

    }
    $scope.compareOrder = function (a, b) {
        if (a.ORDER_ID < b.ORDER_ID) {
            return 1;
        }
        if (a.ORDER_ID > b.ORDER_ID) {
            return -1;
        }

        return 0;
    }
    $scope.refreshOrderList = function () {
        $http.get("/order/list").then(function (response) {
            // console.log(response.data);
            $scope.orders = response.data;
            $scope.orders.sort($scope.compareOrder);
        });
    }
    $scope.refreshOrderList();

    $http.get('/items/autocomplete/').then((response) => {

        $('input.autocomplete').autocomplete({
            data: response.data,
            limit: 20, // The max amount of results that can be shown at once. Default: Infinity.
            onAutocomplete: function (val) {
                // Callback function when value is autcompleted.
            },
            minLength: 4, // The minimum length of the input for the autocomplete to start. Default: 1.
        });
    });


    $http.get("/excel-upload-data").then(function (response) {
        if (response.data.length == 0) {
            $scope.openOrder(0);
        }
        $scope.hdrLoader = false;
        $scope.currentOrder.DATA = response.data;

        for (var i = 0; i < $scope.currentOrder.DATA.length; i++) {
            $scope.fetchSuggestions(i);
        }
    });


    $scope.appendSuggestion = function (index, suggestions) {
        $scope.currentOrder.DATA[index].suggestions = suggestions;
        $scope.currentOrder.DATA[index].loaded = true;

        $scope.currentOrder.DATA[index].suggestions.forEach(function (obj) {
            obj.QTY = $scope.currentOrder.DATA[index].QTY;
            obj.SOURCE = "IM";
            obj.selected = false;
            obj.tooltip = false;
        });
        if (suggestions.length == 1) {
            $scope.currentOrder.DATA[index].suggestions[0].selected = true;
        }

    }

    $scope.fetchSuggestions = function (index) {
        var brand = $scope.currentOrder.DATA[index].BRAND;
        var generic = $scope.currentOrder.DATA[index].GENERIC;
        brand = brand.replace('/', ' ').replace('.', ' ').replace(',', ' ').replace('%', '');
        generic = generic.replace('/', ' ').replace('.', ' ').replace(',', ' ').replace('%', '');

        $scope.currentOrder.DATA[index].loaded = false;
        $http.get("/suggestions/order/" + brand + "/" + generic).then((responseByOrderSearch) => {
            if (responseByOrderSearch.data.length == 0) {
                $http.get("/suggestions/item-master/" + brand).then((responseByBrandSearch) => {
                    if (responseByBrandSearch.data.length == 0) {
                        $http.get("suggestions/item-master/" + generic).then((responseByGenericSearch) => {
                            $scope.appendSuggestion(index, responseByGenericSearch.data);
                        });
                    } else {
                        $scope.appendSuggestion(index, responseByBrandSearch.data);
                    }
                });
            } else {
                $scope.appendSuggestion(index, responseByOrderSearch.data);
            }
        });

    }
    $scope.fetchMoreSuggestions = function (index) {
        var brand = $scope.currentOrder.DATA[index].BRAND;
        var generic = $scope.currentOrder.DATA[index].GENERIC;
        brand = brand.replace('/', ' ').replace('.', ' ').replace(',', ' ').replace('%', '');
        generic = generic.replace('/', ' ').replace('.', ' ').replace(',', ' ').replace('%', '');

        $scope.currentOrder.DATA[index].loaded = false;

        $http.get("/suggestions/item-master/" + brand).then((responseByBrandSearch) => {
            if (responseByBrandSearch.data.length == 0) {
                $http.get("suggestions/item-master/" + generic).then((responseByGenericSearch) => {
                    $scope.appendSuggestion(index, responseByGenericSearch.data);
                });
            } else {
                $scope.appendSuggestion(index, responseByBrandSearch.data);
            }
        });

    }

    $scope.save = function () {
        $scope.hdrLoader = true;
        $http.post("/saveOrder/", $scope.currentOrder).then(function (response) {
            // console.log(response.data);
            $scope.hdrLoader = false;
            $scope.currentOrder = response.data;
            $scope.refreshOrderList();
        });
    }

    $scope.activeOrderIndex = 0;

    $(".menu").sideNav();

    $scope.toggleEdit = function (suggestion) {
        suggestion.edit = !suggestion.edit;
    }
    // $scope.toggleSelect = function (data, suggestion, $event) {
    //     if (!suggestion.edit && data.expanded) {
    //         suggestion.selected = !suggestion.selected;
    //     }
    //     $event.stopPropagation();
    // }

    $scope.toggleSelect = function (suggestion, $event) {
        suggestion.selected = !suggestion.selected;
        $event.stopPropagation();
    }
    $scope.addSuggestion = function (data, $index, $event) {
        if (!data.suggestions) {
            data.suggestions = [];
        }
        data.suggestions.splice($index + 1, 0, { edit: true, selected: true, id: "", name: "", QTY: data.QTY, packing: "", vendor: "", source: "" });

        $event.stopPropagation();

    }
    $scope.getDateString = function (millisec) {
        var d = new Date(millisec);
        return d.toDateString();
    }

    $scope.openOrder = function (index) {
        $scope.activeOrderIndex = index;
        $scope.hdrLoader = true;
        $http.get('/order/' + $scope.orders[index].ORDER_ID).then(function (response) {
            $scope.currentOrder = response.data;
            $('#orderListModal').modal('close');
            $scope.hdrLoader = false;
            for (var i = 0; i < $scope.currentOrder.DATA.length; i++) {
                if ($scope.currentOrder.DATA[i].suggestions.length == 0) {
                    $scope.fetchSuggestions(i);
                }
            }

        });
    }

    $scope.mSuggestionData = {
        ITEM_ID: -1,
        NAME: '',
        QTY: '',
        PACKING: '',
        UNIT: '',
        VENDOR: '',
        SOURCE: 'NEW',
        selected: true,
        tooltip: false
    }
    $scope.mSuggestionParent = {};
    $scope.mSuggestionIndex = -1;

    $scope.addSuggestion = function (data) {
        $scope.mSuggestionParent = {};
        $scope.mSuggestionParent = data;
        $scope.mSuggestionIndex = -1;
    }

    $scope.editSuggestion = function (data, index) {
        $scope.mSuggestionParent = data;
        $scope.mSuggestionIndex = index;
        $scope.mSuggestionData = data.suggestions[index];
        $('#suggestionModal').modal('open');
    }

    $scope.saveSuggestion = function () {
        console.log("Save Suggestion");
        $scope.mSuggestionData.selected = true;
        if ($scope.mSuggestionIndex == -1) {
            $http.post('/insertItem', $scope.mSuggestionData).then(function (response) {
                // console.log(response.data);
                $scope.mSuggestionData = response.data;
                $scope.mSuggestionParent.suggestions.push($scope.mSuggestionData);

            });

        } else {
            $scope.mSuggestionParent.suggestions[$scope.mSuggestionIndex] = $scope.mSuggestionData;
            $scope.mSuggestionParent.loaded = false;
            $http.post('/modifyItem', $scope.mSuggestionData).then((response) => {
                $scope.mSuggestionParent.loaded = true;
            });
        }

    }

    $("a").on('click', function (event) {

        // Make sure this.hash has a value before overriding default behavior
        if (this.hash !== "") {
            // Prevent default anchor click behavior
            event.preventDefault();

            // Store hash
            var hash = this.hash;

            // Using jQuery's animate() method to add smooth page scroll
            // The optional number (800) specifies the number of milliseconds it takes to scroll to the specified area
            $('html, body').animate({
                scrollTop: $(hash).offset().top
            }, 500, function () {

                // Add hash (#) to URL when done scrolling (default click behavior)
                window.location.hash = hash;
            });
        } // End if
    });




});
