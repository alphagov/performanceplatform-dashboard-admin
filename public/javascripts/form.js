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

  $('.modules').delegate('li > a', 'click', function(e) {
    var id = $(this).attr('href');
    $(id).toggleClass('open');
    e.preventDefault();
  });

  // Edit summary
  $('#save-changes').delegate('#commit_message', 'keydown', function (e) {
    var helpTextBlock = $(this).next('p.help-block'),
        textLength = $(this).val().length;

    if (textLength > 48 && textLength <= 60) {
      helpTextBlock.text('Getting a bit long now...');
    } else if (textLength > 60) {
      helpTextBlock.text('Come on, this is ridiculous. We said a short summary!');
    } else {
      helpTextBlock.text('A short summary of what you\'ve changed');
    }
  });


});
