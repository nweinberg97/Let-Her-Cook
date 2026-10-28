# Adds PrivacyInfo.xcprivacy to the App target's "Copy Bundle Resources" phase.
require 'xcodeproj'
project = Xcodeproj::Project.open('ios/App/App.xcodeproj')
target = project.targets.find { |t| t.name == 'App' } or abort 'App target not found'
group = project.main_group.find_subpath('App', false) || project.main_group
unless group.files.any? { |f| f.path == 'PrivacyInfo.xcprivacy' }
  ref = group.new_reference('PrivacyInfo.xcprivacy')
  target.resources_build_phase.add_file_reference(ref, true)
  project.save
  puts 'Added PrivacyInfo.xcprivacy to the App target.'
else
  puts 'PrivacyInfo.xcprivacy already in the project.'
end
