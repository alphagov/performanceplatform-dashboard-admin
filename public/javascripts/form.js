$(document).ready(function () {
  // Show buttons that require JavaScript
  $('#related-links-add').removeClass('hidden');
  $('#start-page-add').removeClass('hidden');

  // Start page link
  $('#start-page-add').click(function (e) {
    $('#hidden-start-page-template').clone().removeAttr('id').removeClass('hidden').appendTo('#start-page');
    $('#start-page-add').hide();
  });

  $('#start-page').delegate('.remove-link', 'click', function (e) {
    $(this).parent().remove();
    $('#start-page-add').show();
  });


  // Related links
  $('#related-links-add').click(function (e) {
    $('#hidden-link-template').clone().removeAttr('id').removeClass('hidden').appendTo('#related-links');
  });

  $('#related-links').delegate('.remove-link', 'click', function (e) {
    $(this).parent().remove();
  });
});
